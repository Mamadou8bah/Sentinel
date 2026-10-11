FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package
FROM eclipse-temurin:17-jre-alpine
RUN addgroup -S sentinel && adduser -S sentinel -G sentinel
WORKDIR /app
COPY --from=build --chown=sentinel:sentinel /build/target/sentinel-backend-*.jar app.jar
RUN mkdir uploads && chown sentinel:sentinel uploads
USER sentinel
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
