package com.sentinel.common.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.net.URI;

@Component
@Profile("render")
public class RenderConfigurationValidator implements InitializingBean {
    private final Environment env;

    public RenderConfigurationValidator(Environment env) {
        this.env = env;
    }

    private String required(String name) {
        String value = env.getProperty(name, "");
        if (value.isBlank() || value.contains("${"))
            throw new IllegalStateException(name + " must be configured");
        return value;
    }

    private void equal(String name, String expected) {
        if (!expected.equalsIgnoreCase(required(name)))
            throw new IllegalStateException(name + " must be " + expected);
    }

    private void https(String name, String value, boolean origin) {
        try {
            var uri = URI.create(value);
            if (!"https".equals(uri.getScheme())
                    || uri.getHost() == null
                    || uri.getUserInfo() != null
                    || uri.getQuery() != null
                    || uri.getFragment() != null
                    || (origin && uri.getRawPath() != null && !uri.getRawPath().isEmpty()))
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException failure) {
            throw new IllegalStateException(
                    name + " must contain a valid HTTPS " + (origin ? "origin" : "URL"));
        }
    }

    @Override
    public void afterPropertiesSet() {
        equal("sentinel.seed-demo", "false");
        equal("sentinel.ml.stub", "false");
        equal("spring.flyway.enabled", "true");
        equal("spring.jpa.hibernate.ddl-auto", "validate");
        equal("spring.flyway.baseline-on-migrate", "false");
        for (String key :
                new String[] {
                    "sentinel.jwt.secret", "sentinel.crypto.field-key", "sentinel.ml.api-key"
                })
            if (required(key).length() < 32)
                throw new IllegalStateException(key + " must contain at least 32 characters");
        for (String origin : required("sentinel.cors-origins").split(","))
            https("sentinel.cors-origins", origin.trim(), true);
        https("sentinel.hosted.public-base-url", required("sentinel.hosted.public-base-url"), true);
        https("sentinel.ml.cv-base-url", required("sentinel.ml.cv-base-url"), true);
        https(
                "sentinel.ml.transaction-base-url",
                required("sentinel.ml.transaction-base-url"),
                true);
    }
}
