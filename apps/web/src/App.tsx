import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addParticipantsToTournament,
  createTournament,
  fetchSports,
  fetchTournamentParticipants,
  fetchTournamentStages,
  fetchTournaments,
  generateSingleEliminationBracket,
  generateSingleEliminationStageForTournament
} from "./api";
import {
  GeneratedSingleEliminationStage,
  PrimaryView,
  SingleEliminationBracket,
  SportDefinition,
  Tournament,
  TournamentParticipant,
  TournamentStage
} from "./types";

const views: Array<PrimaryView | "ALL"> = ["ALL", "BRACKET", "HYBRID", "STANDINGS", "LEADERBOARD"];

function getViewLabel(view: PrimaryView | "ALL"): string {
  if (view === "ALL") return "All Sports";
  if (view === "BRACKET") return "Bracket";
  if (view === "HYBRID") return "League + Playoff";
  if (view === "STANDINGS") return "Standings";
  return "Leaderboard";
}

export function App() {
  const [sports, setSports] = useState<SportDefinition[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeView, setActiveView] = useState<PrimaryView | "ALL">("ALL");

  const [selectedSportId, setSelectedSportId] = useState<number | "">("");
  const [tournamentName, setTournamentName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [participantInput, setParticipantInput] = useState("Alpha\nBravo\nCharlie\nDelta\nEcho\nFoxtrot\nGolf");
  const [bracket, setBracket] = useState<SingleEliminationBracket | null>(null);
  const [isGeneratingBracket, setIsGeneratingBracket] = useState(false);

  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [participantBulkInput, setParticipantBulkInput] = useState("Team Nova\nTeam Bolt\nTeam Flux\nTeam Vortex");
  const [stageName, setStageName] = useState("");
  const [tournamentParticipants, setTournamentParticipants] = useState<TournamentParticipant[]>([]);
  const [tournamentStages, setTournamentStages] = useState<TournamentStage[]>([]);
  const [generatedStage, setGeneratedStage] = useState<GeneratedSingleEliminationStage | null>(null);
  const [isAddingParticipants, setIsAddingParticipants] = useState(false);
  const [isGeneratingStage, setIsGeneratingStage] = useState(false);
  const [isLoadingTournamentContext, setIsLoadingTournamentContext] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const filteredSports = useMemo(() => {
    if (activeView === "ALL") {
      return sports;
    }

    return sports.filter((sport) => sport.primaryView === activeView);
  }, [sports, activeView]);

  const viewStats = useMemo(() => {
    const summary: Record<PrimaryView, number> = {
      BRACKET: 0,
      HYBRID: 0,
      STANDINGS: 0,
      LEADERBOARD: 0
    };

    for (const sport of sports) {
      summary[sport.primaryView] += 1;
    }

    return summary;
  }, [sports]);

  const activeTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId]
  );

  async function loadData() {
    const [sportsResponse, tournamentsResponse] = await Promise.all([fetchSports(), fetchTournaments()]);

    setSports(sportsResponse);
    setTournaments(tournamentsResponse);
    setSelectedTournamentId((currentId) => currentId || tournamentsResponse[0]?.id || "");
  }

  useEffect(() => {
    loadData().catch(() => {
      setErrorMessage("Could not load initial data. Check if API is running on port 4000.");
    });
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) {
      setTournamentParticipants([]);
      setTournamentStages([]);
      setGeneratedStage(null);
      return;
    }

    setIsLoadingTournamentContext(true);

    Promise.all([
      fetchTournamentParticipants(selectedTournamentId),
      fetchTournamentStages(selectedTournamentId)
    ])
      .then(([participants, stages]) => {
        setTournamentParticipants(participants);
        setTournamentStages(stages);
      })
      .catch(() => {
        setErrorMessage("Could not load tournament participants or stages.");
      })
      .finally(() => {
        setIsLoadingTournamentContext(false);
      });
  }, [selectedTournamentId]);

  async function onCreateTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!tournamentName.trim() || !selectedSportId) {
      setErrorMessage("Tournament name and sport are required.");
      return;
    }

    try {
      setIsSaving(true);
      const created = await createTournament({
        name: tournamentName.trim(),
        sportId: Number(selectedSportId)
      });

      setTournaments((current) => [created, ...current]);
      setSelectedTournamentId(created.id);
      setTournamentName("");
      setSelectedSportId("");
    } catch (_error) {
      setErrorMessage("Could not create tournament. Please verify API and inputs.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onGenerateBracket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const participantNames = participantInput
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (participantNames.length < 2) {
      setErrorMessage("Enter at least 2 participant names to generate a bracket.");
      return;
    }

    try {
      setIsGeneratingBracket(true);
      const generated = await generateSingleEliminationBracket(participantNames);
      setBracket(generated);
    } catch (_error) {
      setErrorMessage("Could not generate bracket. Please check API and participant data.");
    } finally {
      setIsGeneratingBracket(false);
    }
  }

  async function onAddParticipants(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!selectedTournamentId) {
      setErrorMessage("Create or select a tournament first.");
      return;
    }

    const names = participantBulkInput
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (names.length < 1) {
      setErrorMessage("Enter at least one participant.");
      return;
    }

    try {
      setIsAddingParticipants(true);
      const participants = await addParticipantsToTournament(selectedTournamentId, names);
      setTournamentParticipants(participants);
      setParticipantBulkInput("");
    } catch (_error) {
      setErrorMessage("Could not add participants to tournament.");
    } finally {
      setIsAddingParticipants(false);
    }
  }

  async function onGenerateStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!selectedTournamentId) {
      setErrorMessage("Select a tournament before generating a stage.");
      return;
    }

    try {
      setIsGeneratingStage(true);
      const stage = await generateSingleEliminationStageForTournament(
        selectedTournamentId,
        stageName.trim() || undefined
      );

      setGeneratedStage(stage);
      setStageName("");
      setTournamentStages((current) => {
        const merged = [stage.stage, ...current];
        const dedupedById = Array.from(new Map(merged.map((item) => [item.id, item])).values());
        return dedupedById.sort((a, b) => a.sequence - b.sequence);
      });
    } catch (_error) {
      setErrorMessage("Could not generate persistent single-elimination stage.");
    } finally {
      setIsGeneratingStage(false);
    }
  }

  function renderBracketBoard(targetBracket: SingleEliminationBracket) {
    return (
      <div className="bracket-wrapper">
        <div className="bracket-header">
          <span>Participants: {targetBracket.participantCount}</span>
          <span>Slots: {targetBracket.slots}</span>
          <span>Byes: {targetBracket.byeCount}</span>
        </div>
        <div className="rounds-row">
          {targetBracket.rounds.map((round) => (
            <div className="round-column" key={round.roundIndex}>
              <h3>{round.title}</h3>
              {round.matches.map((match) => (
                <article className="match-card" key={match.id}>
                  <div className="line">
                    <span>{match.left.participantName ?? "TBD"}</span>
                    <small>{match.left.seed ? `S${match.left.seed}` : "-"}</small>
                  </div>
                  <div className="line">
                    <span>{match.right.participantName ?? "TBD"}</span>
                    <small>{match.right.seed ? `S${match.right.seed}` : "-"}</small>
                  </div>
                  <p className={`status ${match.status.toLowerCase()}`}>
                    {match.status === "AUTO_ADVANCE" ? `Auto advance: ${match.autoAdvanceWinner}` : match.status}
                  </p>
                </article>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="glow glow-a" />
      <div className="glow glow-b" />

      <header className="hero">
        <motion.p
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="eyebrow"
        >
          Zemo Tournament Command Center
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Build Brackets. Run Leagues. Dominate Leaderboards.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="hero-copy"
        >
          One platform for all 52 sports with format-aware orchestration and a stunning live experience.
        </motion.p>
      </header>

      <section className="summary-grid">
        <article>
          <span>Total Sports</span>
          <strong>{sports.length}</strong>
        </article>
        <article>
          <span>Bracket Ready</span>
          <strong>{viewStats.BRACKET + viewStats.HYBRID}</strong>
        </article>
        <article>
          <span>Leaderboard Sports</span>
          <strong>{viewStats.LEADERBOARD}</strong>
        </article>
        <article>
          <span>Live Tournaments</span>
          <strong>{tournaments.length}</strong>
        </article>
      </section>

      <section className="panel">
        <h2>Start a Tournament</h2>
        <form onSubmit={onCreateTournament} className="create-form">
          <label>
            Tournament Name
            <input
              value={tournamentName}
              onChange={(event) => setTournamentName(event.target.value)}
              placeholder="Inter-College Basketball Cup"
            />
          </label>

          <label>
            Sport
            <select
              value={selectedSportId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedSportId(value ? Number(value) : "");
              }}
            >
              <option value="">Select a sport</option>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name} ({sport.format})
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={isSaving}>
            {isSaving ? "Creating..." : "Create Tournament"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Tournament Builder</h2>

        <div className="builder-top">
          <label>
            Active Tournament
            <select
              value={selectedTournamentId}
              onChange={(event) => setSelectedTournamentId(event.target.value)}
            >
              <option value="">Select a tournament</option>
              {tournaments.map((tournament) => (
                <option value={tournament.id} key={tournament.id}>
                  {tournament.name} - {tournament.sportName}
                </option>
              ))}
            </select>
          </label>

          <div className="builder-badges">
            <span>{activeTournament ? activeTournament.sportName : "No tournament selected"}</span>
            <span>{isLoadingTournamentContext ? "Loading tournament data..." : `Participants: ${tournamentParticipants.length}`}</span>
            <span>Stages: {tournamentStages.length}</span>
          </div>
        </div>

        <form className="builder-grid" onSubmit={onAddParticipants}>
          <label>
            Participants (one per line)
            <textarea
              value={participantBulkInput}
              onChange={(event) => setParticipantBulkInput(event.target.value)}
              rows={6}
              placeholder="Team A&#10;Team B&#10;Team C"
            />
          </label>

          <button type="submit" disabled={isAddingParticipants || !selectedTournamentId}>
            {isAddingParticipants ? "Adding..." : "Add Participants"}
          </button>
        </form>

        <form className="builder-stage-form" onSubmit={onGenerateStage}>
          <label>
            Stage Name (optional)
            <input
              value={stageName}
              onChange={(event) => setStageName(event.target.value)}
              placeholder="Quarter Final Phase"
            />
          </label>

          <button type="submit" disabled={isGeneratingStage || !selectedTournamentId}>
            {isGeneratingStage ? "Generating..." : "Generate Persisted Single-Elimination Stage"}
          </button>
        </form>

        {tournamentParticipants.length > 0 ? (
          <div className="participant-chip-wrap">
            {tournamentParticipants.map((participant) => (
              <span key={participant.id} className="participant-chip">
                S{participant.seed ?? "-"} {participant.name}
              </span>
            ))}
          </div>
        ) : null}

        {tournamentStages.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Stage Name</th>
                  <th>Format</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tournamentStages.map((stage) => (
                  <tr key={stage.id}>
                    <td>{stage.sequence}</td>
                    <td>{stage.name}</td>
                    <td>{stage.format}</td>
                    <td>{stage.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {generatedStage ? (
          <div className="generated-stage-block">
            <h3>
              Latest Generated Stage: {generatedStage.stage.name} (#{generatedStage.stage.sequence})
            </h3>
            {renderBracketBoard(generatedStage.bracket)}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Sport Formats</h2>
        <div className="pill-row">
          {views.map((view) => (
            <button
              key={view}
              type="button"
              className={view === activeView ? "active" : ""}
              onClick={() => setActiveView(view)}
            >
              {getViewLabel(view)}
            </button>
          ))}
        </div>

        <div className="sport-grid">
          <AnimatePresence>
            {filteredSports.map((sport, index) => (
              <motion.article
                key={sport.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.96 }}
                transition={{ duration: 0.24, delay: index * 0.01 }}
                className="sport-card"
              >
                <div className="sport-top">
                  <span>#{sport.id}</span>
                  <span className={`tag ${sport.primaryView.toLowerCase()}`}>{sport.primaryView}</span>
                </div>
                <h3>{sport.name}</h3>
                <p>{sport.format}</p>
                <p className="muted">Rule: {sport.rankingRule}</p>
                {sport.notes ? <p className="note">{sport.notes}</p> : null}
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </section>

      <section className="panel">
        <h2>Bracket Playground</h2>
        <form onSubmit={onGenerateBracket} className="bracket-form">
          <label>
            Participants (one per line)
            <textarea
              value={participantInput}
              onChange={(event) => setParticipantInput(event.target.value)}
              rows={7}
              placeholder="Team A&#10;Team B&#10;Team C"
            />
          </label>
          <button type="submit" disabled={isGeneratingBracket}>
            {isGeneratingBracket ? "Generating..." : "Generate Single Elimination"}
          </button>
        </form>

        {bracket ? renderBracketBoard(bracket) : null}
      </section>

      <section className="panel">
        <h2>Recent Tournaments</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Sport</th>
                <th>Format</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.length === 0 ? (
                <tr>
                  <td colSpan={5}>No tournaments yet. Create your first event above.</td>
                </tr>
              ) : (
                tournaments.map((tournament) => (
                  <tr key={tournament.id}>
                    <td>{tournament.name}</td>
                    <td>{tournament.sportName}</td>
                    <td>{tournament.format}</td>
                    <td>{tournament.status}</td>
                    <td>{new Date(tournament.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {errorMessage ? <p className="error-box">{errorMessage}</p> : null}
    </div>
  );
}
