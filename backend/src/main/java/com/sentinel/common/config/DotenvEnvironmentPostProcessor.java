package com.sentinel.common.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Loads a local {@code .env} file into the Spring Environment when present.
 * Searches {@code ./backend/.env}, {@code ./.env}, and parent {@code .env} (monorepo root).
 * Does not override real OS / shell environment variables.
 */
public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Path cwd = Path.of("").toAbsolutePath().normalize();
        for (Path candidate : new Path[] {
            cwd.resolve(".env"),
            cwd.resolve("backend").resolve(".env"),
            cwd.getParent() != null ? cwd.getParent().resolve(".env") : null
        }) {
            if (candidate == null || !Files.isRegularFile(candidate)) {
                continue;
            }
            Map<String, Object> values = parseDotEnv(candidate);
            if (!values.isEmpty()) {
                environment.getPropertySources().addLast(new MapPropertySource("dotenv:" + candidate, values));
            }
        }
    }

    private static Map<String, Object> parseDotEnv(Path file) {
        Map<String, Object> map = new LinkedHashMap<>();
        try {
            for (String line : Files.readAllLines(file)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                int eq = trimmed.indexOf('=');
                if (eq <= 0) {
                    continue;
                }
                String key = trimmed.substring(0, eq).trim();
                String value = trimmed.substring(eq + 1).trim();
                if ((value.startsWith("\"") && value.endsWith("\""))
                        || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length() - 1);
                }
                if (System.getenv(key) == null && System.getProperty(key) == null) {
                    map.put(key, value);
                }
            }
        } catch (IOException ignored) {
            // Missing/unreadable .env is fine — fall back to application.yml defaults
        }
        return map;
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
