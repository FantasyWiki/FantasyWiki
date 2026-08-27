import com.github.gradle.node.npm.task.NpmTask
import groovy.json.JsonSlurper
import java.io.ByteArrayOutputStream
import javax.inject.Inject
import org.gradle.api.tasks.options.Option
import org.gradle.process.ExecOperations

plugins {
    alias(libs.plugins.gitSemVer)
    alias(libs.plugins.taskTree)
    alias(libs.plugins.node)
}

val packageJson = JsonSlurper().parse(file("package.json")) as Map<*, *>
val engines = packageJson["engines"] as Map<*, *>

node {
    download = true
    version = engines["node"] as String
    npmVersion = engines["npm"] as String
    npmInstallCommand = "ci"
}

buildscript {
    configurations.classpath {
        resolutionStrategy.activateDependencyLocking()
    }
}

tasks.register("check") {
    dependsOn(
        "npm_ci",
        ":frontend:check",
        ":backend:check",
        ":scoring-collector:check",
    )
}

tasks.register("dev") {
    group = "development"
    description = "Run the app on this machine, with the Article Genie (needs `wrangler login`)"
    dependsOn(
        ":frontend:devNoMock",
        ":backend:npm_run_devgenie",
    )
}

tasks.register("devNoGenie") {
    group = "development"
    description = "Run the app on this machine, without the Article Genie"
    dependsOn(
        ":frontend:devNoMock",
        ":backend:npm_run_dev",
    )
}

// No Genie here on purpose, unlike `dev`. MSW fakes the market the Genie
// searches, so pairing mocked game data with a live model bills real neurons to
// interrogate fixtures — and this is the task a first run is pointed at, which
// should ask for no account at all.
tasks.register("devMock") {
    group = "development"
    description = "Run the app on this machine against MSW mocks (no Cloudflare account needed)"
    dependsOn(
        ":frontend:devMock",
        ":backend:npm_run_dev",
    )
}

/**
 * The Docker stack, one memorable name per combination.
 *
 * Two switches used to mean juggling `-f` files, `--profile` flags and an
 * environment variable on the command line; these four tasks name the four
 * answers instead. The Genie axis is NPM_CMD — which wrangler environment the
 * Worker runs in — and the demo-data axis is Compose's `demo` profile, which
 * adds a db-seed service that runs to completion before the Worker starts.
 *
 *   ./gradlew up            # dev servers, Article Genie on   (needs a token)
 *   ./gradlew noGenie       # dev servers, Article Genie off  (no credentials)
 *   ./gradlew demo          # ...seeded with the demo league, Genie on
 *   ./gradlew demoNoGenie   # ...seeded with the demo league, Genie off
 *
 * The Genie ones need CLOUDFLARE_API_TOKEN in `backend/.dev.vars`, which is
 * where this project's other local secrets already live — the committed
 * .dev.vars.example says how to create one. Without it the backend stops with a
 * message saying so rather than hanging on an OAuth flow it cannot finish.
 */
fun registerComposeTask(
    name: String,
    description: String,
    npmCommand: String,
    vararg composeArgs: String,
) = tasks.register<Exec>(name) {
    group = "docker"
    this.description = description
    // The compose file lives at the repository root, which is this project.
    workingDir = layout.projectDirectory.asFile
    commandLine("docker", "compose", *composeArgs, "up")
    // Through the environment rather than concatenated into the command line:
    // `NPM_CMD=x docker ...` is bash syntax that neither PowerShell nor cmd
    // understands, and this is the one build everyone runs on whichever shell
    // they happen to have.
    environment("NPM_CMD", npmCommand)
    // `up` never returns, so there is no output to be up to date with. Without
    // this Gradle would call a second run of an unchanged stack UP-TO-DATE and
    // start nothing.
    outputs.upToDateWhen { false }
}

registerComposeTask(
    "up",
    "Run the app in Docker, with the Article Genie (needs a Cloudflare token)",
    npmCommand = "devgenie",
)

registerComposeTask(
    "noGenie",
    "Run the app in Docker, without the Article Genie",
    npmCommand = "dev",
)

registerComposeTask(
    "demo",
    "Run the app in Docker with the demo league seeded, with the Article Genie (needs a token)",
    npmCommand = "devgenie",
    "--profile", "demo",
)

registerComposeTask(
    "demoNoGenie",
    "Run the app in Docker with the demo league seeded, without the Article Genie",
    npmCommand = "dev",
    "--profile", "demo",
)

tasks.register("fix") {
    dependsOn(
        ":frontend:fix",
        ":backend:fix",
        ":scoring-collector:ktlintFormat",
    )
}

/**
 * Resolves the player behind a problem report. A report's GitHub issue carries
 * only the opaque `players.id` — never an email, because the repository is
 * public — so identifying the reporter means querying our own D1.
 *
 * Defaults to production. Reports filed from QA carry the `preview` label and
 * live in the preview database; pass `--preview` for those. Pointing at the
 * wrong one returns no rows rather than the wrong person.
 *
 *   ./gradlew who --player=3f2a9c1e-...
 *   ./gradlew who --player=3f2a9c1e-... --preview
 */
abstract class WhoTask : DefaultTask() {

    @get:Input
    @get:Optional
    @get:Option(
        option = "player",
        description = "The players.id from the issue's Diagnostics block",
    )
    abstract val player: Property<String>

    @get:Input
    @get:Option(
        option = "preview",
        description = "Query the QA database (db-preview) instead of production",
    )
    abstract val preview: Property<Boolean>

    @get:Internal
    abstract val backendDir: DirectoryProperty

    @get:Inject
    abstract val execOps: ExecOperations

    init {
        preview.convention(false)
    }

    @TaskAction
    fun lookUp() {
        val playerId = player.orNull
            ?: throw GradleException(
                "Missing --player. Usage: ./gradlew who --player=<uuid> [--preview]",
            )

        // The id is interpolated into SQL, so it must be a UUID and nothing else.
        require(playerId.matches(Regex("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"))) {
            "Not a player uuid: '$playerId'. Copy it from the issue's Diagnostics " +
                "block, without the surrounding backticks."
        }

        // `db` is the *binding*, identical in both environments; only --env
        // decides which database it resolves to. The database names themselves
        // (db / db-preview) are not addressable, because wrangler.jsonc declares
        // d1_databases per-env and nothing at the top level.
        val environment = if (preview.get()) "preview" else "production"
        // One line on purpose: wrangler splits --command on newlines, so a
        // pretty-printed query runs as several broken statements.
        val sql = "SELECT p.username, ga.email, p.created_at FROM players p " +
            "JOIN google_accounts ga ON ga.id = p.accountId WHERE p.id = '$playerId';"

        // Wrangler only draws its table when stdout is a TTY; under Gradle it is
        // a pipe, so it emits JSON instead. We capture that and draw the table
        // ourselves. Its warnings go to stderr and stream through untouched.
        val stdout = ByteArrayOutputStream()
        val isWindows = System.getProperty("os.name").lowercase().contains("win")
        val result = execOps.exec {
            workingDir = backendDir.get().asFile
            commandLine(
                if (isWindows) "npx.cmd" else "npx",
                "wrangler", "d1", "execute", "db",
                "--env", environment,
                "--remote", "--json", "--command", sql,
            )
            standardOutput = stdout
            isIgnoreExitValue = true
        }

        val output = stdout.toString()
        if (result.exitValue != 0) {
            throw GradleException("wrangler failed:\n$output")
        }

        val rows = parseRows(output)
        logger.lifecycle("")
        if (rows.isEmpty()) {
            logger.lifecycle("No player '$playerId' in the $environment database.")
            if (!preview.get()) {
                logger.lifecycle(
                    "Is the issue labelled `preview`? If so, re-run with --preview.",
                )
            }
            return
        }

        renderTable(rows).forEach { logger.lifecycle(it) }
        logger.lifecycle(
            "\nOnly contact them if the issue carries the `contact-ok` label - that " +
                "label is the only record that they agreed to be contacted.",
        )
    }

    /**
     * Wrangler prints warnings before its JSON, so the payload is read from the
     * first bracket rather than by parsing the whole stream.
     */
    @Suppress("UNCHECKED_CAST")
    private fun parseRows(output: String): List<Map<String, Any?>> {
        val start = output.indexOfFirst { it == '[' || it == '{' }
        if (start < 0) return emptyList()

        val parsed = JsonSlurper().parseText(output.substring(start))
        val envelopes = if (parsed is List<*>) parsed else listOf(parsed)
        return envelopes.flatMap { envelope ->
            val results = (envelope as? Map<*, *>)?.get("results") as? List<*> ?: emptyList<Any?>()
            results.mapNotNull { it as? Map<String, Any?> }
        }
    }

    private fun renderTable(rows: List<Map<String, Any?>>): List<String> {
        val columns = rows.first().keys.toList()
        val widths = columns.associateWith { column ->
            maxOf(
                column.length,
                rows.maxOf { (it[column]?.toString() ?: "").length },
            )
        }

        // ASCII on purpose: Gradle writes through the JVM's default charset,
        // which on a Windows console is cp1252 — box-drawing characters come out
        // as literal question marks there.
        fun rule() =
            columns.joinToString("+", "+", "+") { "-".repeat(widths.getValue(it) + 2) }

        fun cells(values: List<String>) =
            values.mapIndexed { index, value ->
                " " + value.padEnd(widths.getValue(columns[index])) + " "
            }.joinToString("|", "|", "|")

        return buildList {
            add(rule())
            add(cells(columns))
            add(rule())
            rows.forEach { row ->
                add(cells(columns.map { row[it]?.toString() ?: "" }))
            }
            add(rule())
        }
    }
}

tasks.register<WhoTask>("who") {
    group = "help"
    description = "Identify the player who filed a problem report: --player=<uuid> [--preview]"
    backendDir.set(layout.projectDirectory.dir("backend"))
}

group = "io.github.FantasyWiki"
