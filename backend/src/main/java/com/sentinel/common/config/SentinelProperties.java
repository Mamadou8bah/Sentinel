package com.sentinel.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "sentinel")
public class SentinelProperties {

    private final Ml ml = new Ml();
    private final Storage storage = new Storage();

    public Ml getMl() {
        return ml;
    }

    public Storage getStorage() {
        return storage;
    }

    public static class Ml {
        private String cvBaseUrl = "http://localhost:8001";
        private String transactionBaseUrl = "http://localhost:8002";
        /** When true, use local stub scores instead of calling Python services. */
        private boolean stub = true;

        public String getCvBaseUrl() {
            return cvBaseUrl;
        }

        public void setCvBaseUrl(String cvBaseUrl) {
            this.cvBaseUrl = cvBaseUrl;
        }

        public String getTransactionBaseUrl() {
            return transactionBaseUrl;
        }

        public void setTransactionBaseUrl(String transactionBaseUrl) {
            this.transactionBaseUrl = transactionBaseUrl;
        }

        public boolean isStub() {
            return stub;
        }

        public void setStub(boolean stub) {
            this.stub = stub;
        }
    }

    public static class Storage {
        private String uploadDir = "uploads";
        private int maxSizeMb = 10;

        public String getUploadDir() {
            return uploadDir;
        }

        public void setUploadDir(String uploadDir) {
            this.uploadDir = uploadDir;
        }

        public int getMaxSizeMb() {
            return maxSizeMb;
        }

        public void setMaxSizeMb(int maxSizeMb) {
            this.maxSizeMb = maxSizeMb;
        }
    }
}
