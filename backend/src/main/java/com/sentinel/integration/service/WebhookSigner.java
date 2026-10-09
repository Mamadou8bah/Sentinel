package com.sentinel.integration.service;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
public final class WebhookSigner {
 private WebhookSigner() {}
 public static String sign(String secret,String timestamp,String payload) {
  try {
   Mac mac=Mac.getInstance("HmacSHA256");
   mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
   return HexFormat.of().formatHex(mac.doFinal((timestamp+"."+payload).getBytes(StandardCharsets.UTF_8)));
  } catch(Exception e) { throw new IllegalStateException("Unable to sign webhook",e); }
 }
}
