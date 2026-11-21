package com.sentinel.platform;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/platform/auth")
public class PlatformAuthController {
    private final PlatformAuthService service;
    private final PlatformLoginThrottle throttle;
    public PlatformAuthController(PlatformAuthService service, PlatformLoginThrottle throttle) { this.service=service;this.throttle=throttle; }
    @PostMapping("/login") public PlatformDtos.Session login(@Valid @RequestBody PlatformDtos.Login body,HttpServletRequest request) {
        throttle.check(request.getRemoteAddr()); return service.login(body);
    }
    @PostMapping("/password") public PlatformDtos.Session password(@Valid @RequestBody PlatformDtos.PasswordChange body) { return service.password(body); }
    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT) public void logout() { service.logout(); }
}
