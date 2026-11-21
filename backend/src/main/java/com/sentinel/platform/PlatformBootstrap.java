package com.sentinel.platform;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(name="sentinel.platform.bootstrap-enabled",havingValue="true")
public class PlatformBootstrap implements ApplicationRunner {
    private final PlatformAccountRepository accounts;
    private final PlatformAuditRepository audit;
    private final PasswordEncoder passwords;
    private final Environment env;
    public PlatformBootstrap(PlatformAccountRepository accounts,PlatformAuditRepository audit,PasswordEncoder passwords,Environment env) {
        this.accounts=accounts;this.audit=audit;this.passwords=passwords;this.env=env;
    }
    @Override @Transactional public void run(ApplicationArguments args) {
        if(accounts.count()>0) return; // Never elevate a tenant user or reset an existing operator.
        String username=env.getRequiredProperty("SENTINEL_PLATFORM_ADMIN_USERNAME");
        String password=env.getRequiredProperty("SENTINEL_PLATFORM_ADMIN_PASSWORD");
        if(!username.matches("[A-Za-z0-9._@-]{3,64}")) throw new IllegalStateException("Invalid platform admin username");
        PlatformAuthService.validatePassword(password);
        var account=new PlatformAccount();account.setUsername(username);account.setPasswordHash(passwords.encode(password));accounts.save(account);
        audit.save(new PlatformAuditEvent("bootstrap","PLATFORM_ACCOUNT_CREATED",null,"Initial platform operator provisioned"));
    }
}
