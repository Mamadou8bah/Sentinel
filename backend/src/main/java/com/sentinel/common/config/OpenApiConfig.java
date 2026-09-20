package com.sentinel.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI sentinelOpenApi() {
        final String scheme = "bearerAuth";
        return new OpenAPI()
                .info(new Info()
                        .title("Sentinel API")
                        .description(
                                "Bank compliance API — staff JWT + bank integration API keys. "
                                        + "KYC sessions, document verify, real-time TX score, cases, audit.")
                        .version("0.3.0")
                        .contact(new Contact().name("Sentinel")))
                .addSecurityItem(new SecurityRequirement().addList(scheme))
                .addSecurityItem(new SecurityRequirement().addList("apiKeyAuth"))
                .components(new Components()
                        .addSecuritySchemes(
                                scheme,
                                new SecurityScheme()
                                        .name(scheme)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT"))
                        .addSecuritySchemes(
                                "apiKeyAuth",
                                new SecurityScheme()
                                        .name("X-Api-Key")
                                        .type(SecurityScheme.Type.APIKEY)
                                        .in(SecurityScheme.In.HEADER)));
    }
}
