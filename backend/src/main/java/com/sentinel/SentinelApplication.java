package com.sentinel;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
@org.springframework.scheduling.annotation.EnableScheduling
public class SentinelApplication {

    public static void main(String[] args) {
        SpringApplication.run(SentinelApplication.class, args);
    }
}
