package com.sentinel.deployment;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.sentinel.auth.security.DeploymentBootstrap;
import com.sentinel.auth.repository.UserRepository;
import com.sentinel.auth.model.User;
import com.sentinel.auth.model.Role;
import com.sentinel.tenant.repository.TenantRepository;
import com.sentinel.tenant.service.TenantService;
import com.sentinel.risk.repository.RiskSettingsRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
class DeploymentBootstrapTest {
 private MockEnvironment environment(){return new MockEnvironment()
 .withProperty("SENTINEL_BOOTSTRAP_TENANT_CODE","sutura")
 .withProperty("SENTINEL_BOOTSTRAP_ADMIN_USERNAME","operator")
 .withProperty("SENTINEL_BOOTSTRAP_ADMIN_PASSWORD","isolated-test-password-12345")
 .withProperty("SENTINEL_BOOTSTRAP_API_KEY","isolated-test-integration-key-32-bytes")
 .withProperty("SENTINEL_BOOTSTRAP_WEBHOOK_SECRET","isolated-test-webhook-secret-32-bytes")
 .withProperty("SENTINEL_BOOTSTRAP_WEBHOOK_URL","https://api.example.com/api/v1/webhooks/sentinel");}
 @Test void createsOnlyExplicitCredentialsAndPreservesThemOnRestart(){
  var tenants=mock(TenantRepository.class);var users=mock(UserRepository.class);
  var risks=mock(RiskSettingsRepository.class);var passwords=mock(PasswordEncoder.class);
  var service=mock(TenantService.class);
  when(passwords.encode(anyString())).thenReturn("hashed-test-password");
  when(tenants.save(any())).thenAnswer(call->call.getArgument(0));
  var bootstrap=new DeploymentBootstrap(environment(),tenants,users,risks,passwords,service);
  bootstrap.run(null);
  var user=ArgumentCaptor.forClass(User.class);verify(users).save(user.capture());
  assertEquals("operator",user.getValue().getUsername());
  assertEquals("hashed-test-password",user.getValue().getPasswordHash());
  assertEquals(Role.ADMIN,user.getValue().getRole());
  verify(service).issueApiKey(any(),eq("isolated-test-integration-key-32-bytes"),eq("deployment-integration"));
  when(tenants.existsByCode("sutura")).thenReturn(true);
  bootstrap.run(null);
  verify(users,times(1)).save(any());
 }
 @Test void insecureCallbackCannotProvisionTenant(){
  var tenants=mock(TenantRepository.class);var users=mock(UserRepository.class);
  var bootstrap=new DeploymentBootstrap(environment().withProperty("SENTINEL_BOOTSTRAP_WEBHOOK_URL","http://example.com/hook"),tenants,users,mock(RiskSettingsRepository.class),mock(PasswordEncoder.class),mock(TenantService.class));
  assertThrows(IllegalStateException.class,()->bootstrap.run(null));
  verify(tenants,never()).save(any());verifyNoInteractions(users);
 }
}
