package com.sentinel.customer;

import com.sentinel.customer.service.AccountNameComparison;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class AccountNameComparisonTest {
    @Test void accentsSpacingAndSurnameOrderDoNotCauseFalseMismatch() {
        assertThat(AccountNameComparison.compare("Mamadou Bah", "BAH   MAMADOU")).isEqualTo("MATCH");
        assertThat(AccountNameComparison.compare("José O’Connor", "JOSE OCONNOR")).isEqualTo("MATCH");
    }
    @Test void missingOrPartialOcrIsInconclusive() {
        assertThat(AccountNameComparison.compare("Mamadou Bah", null)).isEqualTo("INCONCLUSIVE");
        assertThat(AccountNameComparison.compare("Mamadou Bah", "Mamadou Buh")).isEqualTo("INCONCLUSIVE");
        assertThat(AccountNameComparison.compare("Mamadou Bah", "Mamadou")).isEqualTo("INCONCLUSIVE");
    }
    @Test void clearlyDifferentFullNamesAreMismatches() {
        assertThat(AccountNameComparison.compare("Mamadou Bah", "Awa Jallow")).isEqualTo("MISMATCH");
    }
}
