# 1단계: React 화면을 만든다 (결과: dist 폴더)
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# 광고 설정은 화면을 만들 때 들어가야 해서 빌드 인자로 받는다 (비워 두면 광고 꺼짐)
ARG VITE_ADSENSE_CLIENT=
ARG VITE_ADSENSE_SLOT_INLINE=
ARG VITE_ADSENSE_SLOT_BOTTOM=
ENV VITE_ADSENSE_CLIENT=$VITE_ADSENSE_CLIENT \
    VITE_ADSENSE_SLOT_INLINE=$VITE_ADSENSE_SLOT_INLINE \
    VITE_ADSENSE_SLOT_BOTTOM=$VITE_ADSENSE_SLOT_BOTTOM
RUN npm run build

# 2단계: 서버(jar 파일)를 만든다. React 결과물을 static 폴더에 넣어서 jar 하나에 함께 담는다.
FROM eclipse-temurin:17-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon --version
COPY src src
COPY --from=web /web/dist src/main/resources/static
RUN ./gradlew --no-daemon bootJar -x test \
 && find build/libs -name '*.jar' ! -name '*-plain.jar' -exec cp {} /src/app.jar \;

# 3단계: 실제로 돌리는 가벼운 이미지
FROM eclipse-temurin:17-jre
RUN useradd --system --create-home --home-dir /app app \
 && mkdir -p /app/data && chown -R app:app /app
WORKDIR /app
COPY --from=build /src/app.jar app.jar
USER app
# 회원 데이터가 들어 있는 DB 파일 위치. 컨테이너를 새로 만들어도 이 폴더는 보존된다.
VOLUME /app/data
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
