package com.sentinel.platform;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class PlatformLoginThrottleTest {
    @Test void repeatedOperatorLoginAttemptsAreBoundedPerAddress() {
        var throttle=new PlatformLoginThrottle();
        for(int n=0;n<10;n++)throttle.check("192.0.2.1");
        assertThatThrownBy(()->throttle.check("192.0.2.1"))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("429");
        assertThatCode(()->throttle.check("192.0.2.2")).doesNotThrowAnyException();
    }
}
