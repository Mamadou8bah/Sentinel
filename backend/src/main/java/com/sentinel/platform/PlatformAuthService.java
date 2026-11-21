package com.sentinel.platform;

import com.sentinel.auth.service.JwtService;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PlatformAuthService {
    private final PlatformAccountRepository accounts;
    private final PlatformAuditRepository audit;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final String dummyHash;
    public PlatformAuthService(PlatformAccountRepository accounts, PlatformAuditRepository audit,
                               PasswordEncoder passwords, JwtService jwt) {
        this.accounts=accounts; this.audit=audit; this.passwords=passwords; this.jwt=jwt;
        dummyHash=passwords.encode(java.util.UUID.randomUUID().toString());
    }
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public PlatformDtos.Session login(PlatformDtos.Login request) {
        var account=accounts.findByUsername(request.username().trim()).orElse(null);
        boolean matches=passwords.matches(request.password(),account == null ? dummyHash : account.getPasswordHash());
        if(account == null || !account.isEnabled() || !matches) {
            audit.save(new PlatformAuditEvent("anonymous","PLATFORM_LOGIN_FAILED",null,"Credentials rejected"));
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid platform username or password");
        }
        audit.save(new PlatformAuditEvent(account.getUsername(),"PLATFORM_LOGIN",null,"Platform sign-in"));
        return session(account);
    }
    @Transactional
    public PlatformDtos.Session password(PlatformDtos.PasswordChange request) {
        var principal=principal(); var account=accounts.lock(principal.id()).orElseThrow();
        if(!passwords.matches(request.currentPassword(),account.getPasswordHash()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Current password is incorrect");
        validatePassword(request.newPassword());
        if(request.currentPassword().equals(request.newPassword()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a different password");
        account.setPasswordHash(passwords.encode(request.newPassword())); account.revokeSessions();
        accounts.save(account);
        audit.save(new PlatformAuditEvent(account.getUsername(),"PLATFORM_PASSWORD_CHANGED",null,"All previous sessions revoked"));
        return session(account);
    }
    @Transactional
    public void logout() {
        var account=accounts.lock(principal().id()).orElseThrow(); account.revokeSessions(); accounts.save(account);
        audit.save(new PlatformAuditEvent(account.getUsername(),"PLATFORM_LOGOUT",null,"All platform sessions revoked"));
    }
    public static PlatformPrincipal principal() {
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        if(authentication == null || !(authentication.getPrincipal() instanceof PlatformPrincipal operator))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Platform administrator required");
        return operator;
    }
    public static void validatePassword(String password) {
        if(password == null || password.length()<14 || password.getBytes(StandardCharsets.UTF_8).length>72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use a password of at least 14 characters and at most 72 UTF-8 bytes");
    }
    private PlatformDtos.Session session(PlatformAccount account) {
        return new PlatformDtos.Session(jwt.createPlatformToken(account), account.getUsername(), "PLATFORM_ADMIN",
                Instant.now().plusSeconds(jwt.getAccessTokenExpiryMinutes()*60));
    }
}
