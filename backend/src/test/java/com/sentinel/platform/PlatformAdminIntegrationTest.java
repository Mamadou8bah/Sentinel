package com.sentinel.platform;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinel.auth.service.JwtService;
import com.sentinel.auth.security.DataSeeder;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("h2")
class PlatformAdminIntegrationTest {
    private static final String PASSWORD="PlatformTestPassword-123!", STAFF_PASSWORD="TenantTestPassword-123!";
    private static final AtomicInteger REMOTE = new AtomicInteger();
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PlatformAccountRepository accounts;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtService jwt;
    private PlatformAccount owner;
    private String token;

    @BeforeEach void operator() {
        owner=new PlatformAccount();owner.setUsername("owner_"+UUID.randomUUID().toString().substring(0,12));
        owner.setPasswordHash(passwords.encode(PASSWORD));owner=accounts.saveAndFlush(owner);token=jwt.createPlatformToken(owner);
    }
    @Test void platformLoginHasNoTenantAndCannotBeUsedAsTenantStaff() throws Exception {
        var login=platformLogin(owner.getUsername(),PASSWORD,200);
        assertThat(login.get("role").asText()).isEqualTo("PLATFORM_ADMIN");assertThat(login.has("tenantId")).isFalse();
        String operatorToken=login.get("accessToken").asText();
        mvc.perform(get("/api/platform/summary").header("Authorization","Bearer "+operatorToken)).andExpect(status().isOk());
        mvc.perform(get("/api/customers").header("Authorization","Bearer "+operatorToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/me").header("Authorization","Bearer "+operatorToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/platform/summary")).andExpect(status().isForbidden());
        var tenantLogin=tenantLogin("demo-bank","admin","ChangeMe123!");
        mvc.perform(get("/api/platform/summary").header("Authorization","Bearer "+tenantLogin.get("accessToken").asText())).andExpect(status().isForbidden());
        mvc.perform(get("/api/platform/summary").header("X-Api-Key",DataSeeder.DEMO_API_KEY)).andExpect(status().isForbidden());
        platformLogin("admin","ChangeMe123!",401); // Tenant/demo credentials never bootstrap a platform operator.
    }
    @Test void createsTenantAndShowsIntegrationSecretsOnlyOnce() throws Exception {
        var created=createTenant();long id=created.get("tenantId").asLong();
        assertThat(created.get("apiKey").asText()).startsWith("sen_");
        String metadata=mvc.perform(get("/api/platform/tenants/"+id).header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(metadata).doesNotContain(created.get("apiKey").asText(),created.get("webhookSigningSecret").asText(),STAFF_PASSWORD,"passwordHash","keyHash");
        var signedIn=tenantLogin(created.get("code").asText(),"admin",STAFF_PASSWORD);
        mvc.perform(get("/api/me").header("Authorization","Bearer "+signedIn.get("accessToken").asText())).andExpect(status().isOk());
        mvc.perform(get("/api/integration/kyc/sessions/999999").header("X-Api-Key",created.get("apiKey").asText())).andExpect(status().isNotFound());
        String audit=mvc.perform(get("/api/platform/audit").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(audit).contains("TENANT_CREATED").doesNotContain(created.get("apiKey").asText(),created.get("webhookSigningSecret").asText(),STAFF_PASSWORD);
    }
    @Test void tenantSuspensionImmediatelyBlocksJwtAndServiceKeyAndDoesNotReviveOldSessions() throws Exception {
        var created=createTenant();long id=created.get("tenantId").asLong();String code=created.get("code").asText();
        var staff=tenantLogin(code,"admin",STAFF_PASSWORD);String access=staff.get("accessToken").asText();
        updateTenant(id,false,"wrong-code",400);
        updateTenant(id,false,code,200);
        mvc.perform(get("/api/me").header("Authorization","Bearer "+access)).andExpect(status().isForbidden());
        mvc.perform(get("/api/integration/kyc/sessions/999999").header("X-Api-Key",created.get("apiKey").asText())).andExpect(status().isUnauthorized());
        updateTenant(id,true,"",200);
        mvc.perform(get("/api/me").header("Authorization","Bearer "+access)).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("refreshToken",staff.get("refreshToken").asText())))).andExpect(status().isUnauthorized());
        tenantLogin(code,"admin",STAFF_PASSWORD);
    }
    @Test void staffResetRevokesAccessAndRefreshAndLastAdminIsProtected() throws Exception {
        var tenant=createTenant();long id=tenant.get("tenantId").asLong();String code=tenant.get("code").asText();
        var detail=getJson("/tenants/"+id);long adminId=detail.get("staff").get(0).get("id").asLong();
        mvc.perform(put("/api/platform/tenants/"+id+"/staff/"+adminId).header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("role","ADMIN","enabled",false,"reason","Access policy change")))).andExpect(status().isConflict());
        var staff=postJson("/tenants/"+id+"/staff",Map.of("username","analyst","password",STAFF_PASSWORD,"role","ANALYST","reason","Add operations analyst"),201);
        var login=tenantLogin(code,"analyst",STAFF_PASSWORD);
        postJson("/tenants/"+id+"/staff/"+staff.get("id").asLong()+"/password",Map.of("password","ChangedStaffPassword-456!","reason","Reset for account recovery"),204);
        mvc.perform(get("/api/me").header("Authorization","Bearer "+login.get("accessToken").asText())).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("refreshToken",login.get("refreshToken").asText())))).andExpect(status().isUnauthorized());
        tenantLogin(code,"analyst","ChangedStaffPassword-456!");
    }
    @Test void keyRevocationAndTenantOwnershipAreEnforced() throws Exception {
        var first=createTenant();var second=createTenant();long id=first.get("tenantId").asLong();
        var issued=postJson("/tenants/"+id+"/keys",Map.of("name","Production integration","reason","Provision integration key"),201);
        String key=issued.get("apiKey").asText();
        mvc.perform(get("/api/integration/kyc/sessions/999999").header("X-Api-Key",key)).andExpect(status().isNotFound());
        postJson("/tenants/"+second.get("tenantId").asLong()+"/keys/"+issued.get("id").asLong()+"/revoke",Map.of("reason","Revoke compromised key"),404);
        postJson("/tenants/"+id+"/keys/"+issued.get("id").asLong()+"/revoke",Map.of("reason","Revoke compromised key"),204);
        mvc.perform(get("/api/integration/kyc/sessions/999999").header("X-Api-Key",key)).andExpect(status().isUnauthorized());
        long otherStaff=getJson("/tenants/"+second.get("tenantId").asLong()).get("staff").get(0).get("id").asLong();
        postJson("/tenants/"+id+"/staff/"+otherStaff+"/password",Map.of("password","ChangedStaffPassword-456!","reason","Reset for account recovery"),404);
    }
    @Test void operatorPasswordChangeAndLogoutRevokePreviousTokens() throws Exception {
        var changed=postJson("/auth/password",Map.of("currentPassword",PASSWORD,"newPassword","ChangedPlatformPassword-456!"),200);
        mvc.perform(get("/api/platform/summary").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        token=changed.get("accessToken").asText();getJson("/summary");
        platformLogin(owner.getUsername(),PASSWORD,401);platformLogin(owner.getUsername(),"ChangedPlatformPassword-456!",200);
        postJson("/auth/logout",null,204);
        mvc.perform(get("/api/platform/summary").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
    }
    @Test void validatesPaginationPasswordBytesAndWebhookScheme() throws Exception {
        mvc.perform(get("/api/platform/tenants?size=500").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/platform/audit?page=-1").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        postJson("/auth/password",Map.of("currentPassword",PASSWORD,"newPassword","é".repeat(40)),400);
        postJson("/tenants",Map.of("code","unsafe-"+UUID.randomUUID().toString().substring(0,8),"name","Unsafe callback","adminUsername","admin","adminPassword",STAFF_PASSWORD,"webhookUrl","http://example.com/webhook","reason","Test unsafe callback rejection"),400);
    }
    @Test void webhookSecretRotationIsOneTimeAndNeverExposedByMetadataOrAudit() throws Exception {
        var tenant=createTenant();long id=tenant.get("tenantId").asLong();
        var rotated=postJson("/tenants/"+id+"/webhook-secret",Map.of("reason","Rotate callback signing credential"),200);
        String value=rotated.get("webhookSigningSecret").asText();
        assertThat(value).hasSize(64).isNotEqualTo(tenant.get("webhookSigningSecret").asText());
        assertThat(getJson("/tenants/"+id).toString()).doesNotContain(value);
        assertThat(getJson("/audit").toString()).contains("WEBHOOK_SECRET_ROTATED").doesNotContain(value);
    }
    @Test void staffRoleAndAccessChangesRevokePreviousSessions() throws Exception {
        var tenant=createTenant();long id=tenant.get("tenantId").asLong();String code=tenant.get("code").asText();
        var created=postJson("/tenants/"+id+"/staff",Map.of("username","reviewer","password",STAFF_PASSWORD,"role","ANALYST","reason","Provision tenant reviewer"),201);
        long userId=created.get("id").asLong();String previous=tenantLogin(code,"reviewer",STAFF_PASSWORD).get("accessToken").asText();
        mvc.perform(put("/api/platform/tenants/"+id+"/staff/"+userId).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("role","COMPLIANCE","enabled",true,"reason","Grant compliance duties")))).andExpect(status().isOk());
        mvc.perform(get("/api/me").header("Authorization","Bearer "+previous)).andExpect(status().isForbidden());
        var changed=tenantLogin(code,"reviewer",STAFF_PASSWORD);assertThat(changed.get("role").asText()).isEqualTo("COMPLIANCE");
        mvc.perform(put("/api/platform/tenants/"+id+"/staff/"+userId).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("role","COMPLIANCE","enabled",false,"reason","Suspend departed staff account")))).andExpect(status().isOk());
        mvc.perform(get("/api/me").header("Authorization","Bearer "+changed.get("accessToken").asText())).andExpect(status().isForbidden());
    }
    @Test void disabledOperatorCannotUseExistingTokenOrSignInAgain() throws Exception {
        owner.setEnabled(false);accounts.saveAndFlush(owner);
        mvc.perform(get("/api/platform/summary").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        platformLogin(owner.getUsername(),PASSWORD,401);
    }
    private JsonNode createTenant() throws Exception {
        return postJson("/tenants",Map.of("code","test-"+UUID.randomUUID().toString().substring(0,12),"name","Test Bank","adminUsername","admin","adminPassword",STAFF_PASSWORD,"webhookUrl","https://bank.example/webhooks/sentinel","reason","Provision isolated test tenant"),201);
    }
    private void updateTenant(long id,boolean enabled,String code,int status) throws Exception {
        mvc.perform(put("/api/platform/tenants/"+id).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name","Test Bank","enabled",enabled,"webhookUrl","https://bank.example/webhooks/sentinel","confirmCode",code,"reason","Update tenant access policy")))).andExpect(status().is(status));
    }
    private JsonNode platformLogin(String username,String password,int status) throws Exception {
        var result=mvc.perform(post("/api/platform/auth/login").with(r->{r.setRemoteAddr("127.0.0."+REMOTE.incrementAndGet());return r;}).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username",username,"password",password)))).andExpect(status().is(status)).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    private JsonNode tenantLogin(String code,String username,String password) throws Exception {
        var result=mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("tenantCode",code,"username",username,"password",password)))).andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    private JsonNode getJson(String path) throws Exception {
        return json.readTree(mvc.perform(get("/api/platform"+path).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    private JsonNode postJson(String path,Object body,int status) throws Exception {
        var result=mvc.perform(post("/api/platform"+path).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(body==null?"":json.writeValueAsString(body))).andExpect(status().is(status)).andReturn();
        return status==204 ? json.nullNode() : json.readTree(result.getResponse().getContentAsString());
    }
}
