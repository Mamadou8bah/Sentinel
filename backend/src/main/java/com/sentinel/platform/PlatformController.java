package com.sentinel.platform;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/platform") @PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class PlatformController {
    private final PlatformService service;
    public PlatformController(PlatformService service) {this.service=service;}
    @GetMapping("/me") public PlatformPrincipal me() {return PlatformAuthService.principal();}
    @GetMapping("/summary") public PlatformDtos.Summary summary(){return service.summary();}
    @GetMapping("/tenants") public PlatformDtos.Page<PlatformDtos.TenantRow> tenants(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size){return service.tenants(q,page,size);}
    @PostMapping("/tenants") @ResponseStatus(HttpStatus.CREATED) public PlatformDtos.CreatedTenant create(@Valid @RequestBody PlatformDtos.CreateTenant body){return service.create(body);}
    @GetMapping("/tenants/{id}") public PlatformDtos.TenantDetail detail(@PathVariable Long id){return service.detail(id);}
    @PutMapping("/tenants/{id}") public PlatformDtos.TenantDetail update(@PathVariable Long id,@Valid @RequestBody PlatformDtos.UpdateTenant body){return service.update(id,body);}
    @PostMapping("/tenants/{id}/staff") @ResponseStatus(HttpStatus.CREATED) public PlatformDtos.Staff createStaff(@PathVariable Long id,@Valid @RequestBody PlatformDtos.CreateStaff body){return service.createStaff(id,body);}
    @PutMapping("/tenants/{id}/staff/{staffId}") public PlatformDtos.Staff updateStaff(@PathVariable Long id,@PathVariable Long staffId,@Valid @RequestBody PlatformDtos.UpdateStaff body){return service.updateStaff(id,staffId,body);}
    @PostMapping("/tenants/{id}/staff/{staffId}/password") @ResponseStatus(HttpStatus.NO_CONTENT) public void reset(@PathVariable Long id,@PathVariable Long staffId,@Valid @RequestBody PlatformDtos.ResetPassword body){service.resetPassword(id,staffId,body);}
    @PostMapping("/tenants/{id}/keys") @ResponseStatus(HttpStatus.CREATED) public PlatformDtos.IssuedKey issue(@PathVariable Long id,@Valid @RequestBody PlatformDtos.IssueKey body){return service.issueKey(id,body);}
    @PostMapping("/tenants/{id}/keys/{keyId}/revoke") @ResponseStatus(HttpStatus.NO_CONTENT) public void revoke(@PathVariable Long id,@PathVariable Long keyId,@Valid @RequestBody PlatformDtos.Reason body){service.revokeKey(id,keyId,body);}
    @GetMapping("/audit") public PlatformDtos.Page<PlatformDtos.Audit> audit(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size){return service.audit(page,size);}
    @PostMapping("/tenants/{id}/webhook-secret") public PlatformDtos.IssuedSecret rotateSecret(@PathVariable Long id,@Valid @RequestBody PlatformDtos.Reason body){return service.rotateWebhookSecret(id,body);}
}
