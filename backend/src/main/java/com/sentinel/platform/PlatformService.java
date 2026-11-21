package com.sentinel.platform;

import com.sentinel.auth.model.Role;
import com.sentinel.auth.model.User;
import com.sentinel.auth.repository.UserRepository;
import com.sentinel.auth.repository.RefreshTokenRepository;
import com.sentinel.common.util.Hashing;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.model.TenantApiKey;
import com.sentinel.tenant.repository.*;
import com.sentinel.tenant.service.TenantService;
import com.sentinel.tenant.dto.RegisterTenantRequest;
import jakarta.persistence.EntityManager;
import java.net.URI;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class PlatformService {
    private final TenantRepository tenants;
    private final TenantApiKeyRepository keys;
    private final TenantService tenantService;
    private final UserRepository staff;
    private final RefreshTokenRepository refreshTokens;
    private final PlatformAuditRepository audit;
    private final PasswordEncoder passwords;
    private final EntityManager em;
    public PlatformService(TenantRepository tenants,TenantApiKeyRepository keys,TenantService tenantService,
                           UserRepository staff,RefreshTokenRepository refreshTokens,PlatformAuditRepository audit,
                           PasswordEncoder passwords,EntityManager em) {
        this.tenants=tenants;this.keys=keys;this.tenantService=tenantService;this.staff=staff;
        this.refreshTokens=refreshTokens;this.audit=audit;this.passwords=passwords;this.em=em;
    }
    @Transactional(readOnly=true)
    public PlatformDtos.Summary summary() {
        PlatformAuthService.principal();
        return new PlatformDtos.Summary(tenants.count(),tenants.countByEnabledTrue(),staff.count(),
                count("Customer"),count("TransactionEntity"),count("CaseEntity"));
    }
    @Transactional(readOnly=true)
    public PlatformDtos.Page<PlatformDtos.TenantRow> tenants(String query,int page,int size) {
        PlatformAuthService.principal(); validatePage(page,size);
        var found=tenants.search(query==null?"":query.trim().substring(0,Math.min(query.trim().length(),100)),
                PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"createdAt","id")));
        var ids=found.getContent().stream().map(Tenant::getId).toList();
        var users=counts("User",ids);var customers=counts("Customer",ids);
        var transactions=counts("TransactionEntity",ids);var cases=counts("CaseEntity",ids);
        return new PlatformDtos.Page<>(found.getContent().stream().map(t->row(t,users,customers,transactions,cases)).toList(),
                found.getTotalElements(),page,size);
    }
    @Transactional(readOnly=true)
    public PlatformDtos.TenantDetail detail(Long id) {
        PlatformAuthService.principal();var tenant=tenantService.requireTenant(id);var ids=List.of(id);
        return new PlatformDtos.TenantDetail(row(tenant,counts("User",ids),counts("Customer",ids),counts("TransactionEntity",ids),counts("CaseEntity",ids)),
                staff.findByTenant_IdOrderByCreatedAtAsc(id).stream().map(this::staffRow).toList(),
                keys.findByTenant_IdOrderByCreatedAtDesc(id).stream().map(k->new PlatformDtos.Key(k.getId(),k.getName(),k.getKeyPrefix(),k.isEnabled(),k.getCreatedAt(),k.getLastUsedAt())).toList());
    }
    public PlatformDtos.CreatedTenant create(PlatformDtos.CreateTenant request) {
        PlatformAuthService.principal();PlatformAuthService.validatePassword(request.adminPassword());
        String callback=callback(request.webhookUrl());
        var result=tenantService.register(new RegisterTenantRequest(request.code(),request.name().trim(),
                request.adminUsername(),request.adminPassword(),callback));
        var tenant=tenantService.requireTenant(result.tenantId());String secret=Hashing.randomHex(32);
        tenant.setWebhookSigningSecret(secret);tenants.save(tenant);
        record("TENANT_CREATED",tenant.getId(),request.reason());
        return new PlatformDtos.CreatedTenant(tenant.getId(),tenant.getCode(),result.adminUsername(),result.apiKey(),secret);
    }
    public PlatformDtos.TenantDetail update(Long id,PlatformDtos.UpdateTenant request) {
        var tenant=lock(id);
        if(tenant.isEnabled()&&!request.enabled()&&!tenant.getCode().equals(request.confirmCode()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Type the tenant code to suspend its access");
        if(tenant.isEnabled()&&!request.enabled()) {staff.revokeForTenant(id);refreshTokens.revokeForTenant(id);}
        tenant.setName(request.name().trim());tenant.setEnabled(request.enabled());tenant.setWebhookUrl(callback(request.webhookUrl()));
        tenants.save(tenant);record(request.enabled()?"TENANT_UPDATED":"TENANT_SUSPENDED",id,request.reason());
        return detail(id);
    }
    public PlatformDtos.Staff createStaff(Long tenantId,PlatformDtos.CreateStaff request) {
        var tenant=lock(tenantId);PlatformAuthService.validatePassword(request.password());
        if(staff.existsByTenant_IdAndUsername(tenantId,request.username()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"This username already exists in the tenant");
        var user=new User();user.setTenant(tenant);user.setUsername(request.username());user.setRole(request.role());
        user.setPasswordHash(passwords.encode(request.password()));staff.save(user);
        record("STAFF_CREATED",tenantId,"Staff "+user.getId()+": "+request.reason());return staffRow(user);
    }
    public PlatformDtos.Staff updateStaff(Long tenantId,Long userId,PlatformDtos.UpdateStaff request) {
        lock(tenantId);var user=requireStaff(tenantId,userId);
        if(user.isEnabled()&&user.getRole()==Role.ADMIN&&(!request.enabled()||request.role()!=Role.ADMIN)
                &&staff.countByTenant_IdAndRoleAndEnabledTrue(tenantId,Role.ADMIN)<=1)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Keep at least one enabled tenant admin");
        if(user.isEnabled()!=request.enabled()||user.getRole()!=request.role()) {user.revokeSessions();refreshTokens.revokeForUser(userId);}
        user.setEnabled(request.enabled());user.setRole(request.role());staff.save(user);
        record("STAFF_ACCESS_CHANGED",tenantId,"Staff "+userId+": "+request.reason());return staffRow(user);
    }
    public void resetPassword(Long tenantId,Long userId,PlatformDtos.ResetPassword request) {
        lock(tenantId);var user=requireStaff(tenantId,userId);PlatformAuthService.validatePassword(request.password());
        user.setPasswordHash(passwords.encode(request.password()));user.revokeSessions();staff.save(user);refreshTokens.revokeForUser(userId);
        record("STAFF_PASSWORD_RESET",tenantId,"Staff "+userId+": "+request.reason());
    }
    public PlatformDtos.IssuedKey issueKey(Long id,PlatformDtos.IssueKey request) {
        var tenant=lock(id);String raw="sen_"+Hashing.randomHex(24);
        var key=tenantService.issueApiKey(tenant,raw,request.name().trim());
        record("API_KEY_ISSUED",id,"Key "+key.getId()+": "+request.reason());
        return new PlatformDtos.IssuedKey(key.getId(),key.getName(),raw);
    }
    public void revokeKey(Long tenantId,Long keyId,PlatformDtos.Reason request) {
        lock(tenantId);var key=keys.findById(keyId).filter(k->k.getTenant().getId().equals(tenantId))
                .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"API key not found in this tenant"));
        key.setEnabled(false);keys.save(key);record("API_KEY_REVOKED",tenantId,"Key "+keyId+": "+request.reason());
    }
    public PlatformDtos.IssuedSecret rotateWebhookSecret(Long id,PlatformDtos.Reason request) {
        var tenant=lock(id);String secret=Hashing.randomHex(32);tenant.setWebhookSigningSecret(secret);tenants.save(tenant);
        record("WEBHOOK_SECRET_ROTATED",id,request.reason());return new PlatformDtos.IssuedSecret(secret);
    }
    @Transactional(readOnly=true)
    public PlatformDtos.Page<PlatformDtos.Audit> audit(int page,int size) {
        PlatformAuthService.principal();validatePage(page,size);
        var rows=audit.findAll(PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"createdAt","id")));
        return new PlatformDtos.Page<>(rows.getContent().stream().map(e->new PlatformDtos.Audit(e.getId(),e.getActor(),e.getAction(),e.getTenantId(),e.getDetail(),e.getCreatedAt())).toList(),rows.getTotalElements(),page,size);
    }
    private Tenant lock(Long id) {
        PlatformAuthService.principal();return tenants.findForCustomerEnrollment(id)
                .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Tenant not found"));
    }
    private User requireStaff(Long tenantId,Long userId) {
        return staff.findById(userId).filter(u->u.getTenant().getId().equals(tenantId))
                .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Staff account not found in this tenant"));
    }
    private PlatformDtos.Staff staffRow(User u) {return new PlatformDtos.Staff(u.getId(),u.getUsername(),u.getRole(),u.isEnabled(),u.getCreatedAt());}
    private long count(String entity) {return em.createQuery("select count(e) from "+entity+" e",Long.class).getSingleResult();}
    private Map<Long,Long> counts(String entity,List<Long> ids) {
        if(ids.isEmpty())return Map.of();var result=new HashMap<Long,Long>();
        for(Object[] row:em.createQuery("select e.tenant.id,count(e) from "+entity+" e where e.tenant.id in :ids group by e.tenant.id",Object[].class).setParameter("ids",ids).getResultList())
            result.put((Long)row[0],(Long)row[1]);
        return result;
    }
    private PlatformDtos.TenantRow row(Tenant t,Map<Long,Long> users,Map<Long,Long> customers,Map<Long,Long> transactions,Map<Long,Long> cases) {
        Long id=t.getId();return new PlatformDtos.TenantRow(id,t.getCode(),t.getName(),t.isEnabled(),t.getCreatedAt(),users.getOrDefault(id,0L),
                customers.getOrDefault(id,0L),transactions.getOrDefault(id,0L),cases.getOrDefault(id,0L),t.getWebhookUrl(),
                t.getWebhookSigningSecret()!=null&&!t.getWebhookSigningSecret().isBlank());
    }
    private void record(String action,Long tenant,String detail) {audit.save(new PlatformAuditEvent(PlatformAuthService.principal().username(),action,tenant,detail));}
    private void validatePage(int page,int size) {if(page<0||size<1||size>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid pagination");}
    private String callback(String value) {
        if(value==null||value.isBlank())return null;
        try {var uri=URI.create(value.trim());if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getFragment()!=null)throw new IllegalArgumentException();return uri.toString();}
        catch(IllegalArgumentException ex){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use an HTTPS webhook URL without credentials or a fragment");}
    }
}
