# syntax=docker/dockerfile:1
#
# The Kotlin scoring collector, published to GHCR by
# .github/workflows/publish-images.yml.
#
# Runtime only: the distribution is built by Gradle *before* the image, not
# inside it. A Gradle stage would have to carry the whole monorepo — settings
# .gradle.kts configures the Node subprojects and installs git hooks, so it
# wants `package.json` files and a `.git` directory that have nothing to do with
# this service — for a build the CI runner has already done with a warm cache.
#
# Build it by hand with:
#   ./gradlew :scoring-collector:installDist
#   docker build -f docker/scoring-collector.Dockerfile -t scoring-collector .

FROM eclipse-temurin:21-jre-noble

# An unprivileged user: this reaches out to Wikimedia and to the Worker's ingest
# endpoint and needs nothing on the filesystem it did not ship with.
RUN useradd --system --create-home --shell /usr/sbin/nologin collector
USER collector
WORKDIR /app

COPY --chown=collector:collector scoring-collector/build/install/scoring-collector/ ./

ENTRYPOINT ["/app/bin/scoring-collector"]
