FROM maven:3.9.11-eclipse-temurin-25 AS build
WORKDIR /workspace
COPY . .
ARG SERVICE
RUN mvn -q -pl ${SERVICE} -am -DskipTests package

FROM eclipse-temurin:25-jre
WORKDIR /app
ARG SERVICE
COPY --from=build /workspace/${SERVICE}/target/${SERVICE}-0.1.0.jar /app/app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]
