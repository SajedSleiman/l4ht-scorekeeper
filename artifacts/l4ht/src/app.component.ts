import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Game = 'Leekha' | 'Hand' | '400' | 'Tarneb';
type RoundKind = 'legacy' | 'leekha' | 'hand' | 'contract';
type SpecialCard = 'queenSpades' | 'tenDiamonds';
type FinishType = 'none' | 'normal' | 'hand';
type BidValue = '2' | '3' | '4' | '10' | '12' | '14' | '16' | '18' | 'full';
type TeamName = 'A' | 'B';

interface Player {
  id: string;
  name: string;
}

interface LeekhaEntry {
  hearts: number | null;
  queenSpades: boolean;
  tenDiamonds: boolean;
}

interface HandEntry {
  points: number | null;
  finish: FinishType;
}

interface BidEntry {
  bid: BidValue | null;
  made: boolean | null;
}

interface Round {
  id: string;
  label: string;
  kind: RoundKind;
  entries: Record<string, number | undefined>;
  leekhaEntries?: Record<string, LeekhaEntry>;
  handEntries?: Record<string, HandEntry>;
  bidEntries?: Record<string, BidEntry>;
}

interface Match {
  id: string;
  game: Game;
  createdAt: string;
  players: Player[];
  rounds: Round[];
  fullRoundValue: number | null;
  teamA: [string | null, string | null];
  teamB: [string | null, string | null];
}

type DialogKind = 'new-match' | 'add-player' | 'rename-player' | 'round' | 'confirm' | null;

interface LeekhaElimination {
  roundId: string;
  roundLabel: string;
  roundIndex: number;
  total: number;
}

interface TeamWin {
  teams: TeamName[];
  roundLabel: string;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

@Component({
  selector: 'l4ht-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  readonly games: Game[] = ['Leekha', 'Hand', '400', 'Tarneb'];
  readonly bids: { value: BidValue; label: string }[] = [
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '10', label: '10' },
    { value: '12', label: '12' },
    { value: '14', label: '14' },
    { value: '16', label: '16' },
    { value: '18', label: '18' },
    { value: 'full', label: 'Full Round' },
  ];

  matches: Match[] = [];
  selectedMatchId: string | null = null;
  dialog: DialogKind = null;
  gameDraft: Game = 'Leekha';
  nameDraft = '';
  roundLabelDraft = '';
  editingPlayerId: string | null = null;
  editingRoundId: string | null = null;
  confirmTitle = '';
  confirmMessage = '';
  private confirmAction: (() => void) | null = null;
  private readonly matchesStorageKey = 'l4ht.matches.v2';
  private readonly legacyMatchesStorageKey = 'l4ht.matches.v1';

  ngOnInit(): void {
    try {
      const current = localStorage.getItem(this.matchesStorageKey);
      const legacy = localStorage.getItem(this.legacyMatchesStorageKey);
      const saved = current ?? legacy;
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.matches = parsed
            .map((item) => this.normalizeMatch(item))
            .filter((match): match is Match => match !== null);
        }
      }

      const lastMatch = localStorage.getItem('l4ht.selected.v1');
      if (lastMatch && this.matches.some((match) => match.id === lastMatch)) {
        this.selectedMatchId = lastMatch;
      }
      if (legacy && !current) this.persist();
    } catch {
      this.matches = [];
    }
  }

  get activeMatch(): Match | undefined {
    return this.matches.find((match) => match.id === this.selectedMatchId);
  }

  get totals(): Record<string, number> {
    return this.activeMatch ? this.calculateTotals(this.activeMatch) : {};
  }

  getMatchTotal(match: Match): number {
    return match.rounds.length;
  }

  private normalizeMatch(value: unknown): Match | null {
    const raw = asRecord(value);
    if (!raw || typeof raw.id !== 'string' || typeof raw.game !== 'string') return null;
    const game = this.games.find((item) => item === raw.game) ?? 'Leekha';

    const players: Player[] = Array.isArray(raw.players)
      ? raw.players.flatMap((value) => {
          const player = asRecord(value);
          return player && typeof player.id === 'string' && typeof player.name === 'string'
            ? [{ id: player.id, name: player.name }]
            : [];
        })
      : [];

    const rounds: Round[] = Array.isArray(raw.rounds)
      ? raw.rounds.flatMap((value, index) => {
          const round = asRecord(value);
          if (!round) return [];
          const allowedKinds: RoundKind[] = ['legacy', 'leekha', 'hand', 'contract'];
          const kind = typeof round.kind === 'string' && allowedKinds.includes(round.kind as RoundKind)
            ? round.kind as RoundKind
            : 'legacy';
          return [{
            id: typeof round.id === 'string' ? round.id : `legacy-${index}`,
            label: typeof round.label === 'string' ? round.label : `Round ${index + 1}`,
            kind,
            entries: this.normalizeScoreMap(round.entries),
            leekhaEntries: this.normalizeLeekhaEntries(round.leekhaEntries),
            handEntries: this.normalizeHandEntries(round.handEntries),
            bidEntries: this.normalizeBidEntries(round.bidEntries),
          }];
        })
      : [];

    const teamA = this.normalizeTeam(raw.teamA);
    const teamB = this.normalizeTeam(raw.teamB);
    return {
      id: raw.id,
      game,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      players,
      rounds,
      fullRoundValue: finiteNumber(raw.fullRoundValue),
      teamA,
      teamB,
    };
  }

  private normalizeTeam(value: unknown): [string | null, string | null] {
    if (!Array.isArray(value)) return [null, null];
    return [
      typeof value[0] === 'string' ? value[0] : null,
      typeof value[1] === 'string' ? value[1] : null,
    ];
  }

  private normalizeScoreMap(value: unknown): Record<string, number | undefined> {
    const record = asRecord(value);
    const scores: Record<string, number | undefined> = {};
    if (!record) return scores;
    for (const [id, score] of Object.entries(record)) scores[id] = finiteNumber(score) ?? undefined;
    return scores;
  }

  private normalizeLeekhaEntries(value: unknown): Record<string, LeekhaEntry> {
    const record = asRecord(value);
    const entries: Record<string, LeekhaEntry> = {};
    if (!record) return entries;
    for (const [id, value] of Object.entries(record)) {
      const entry = asRecord(value);
      if (!entry) continue;
      entries[id] = {
        hearts: finiteNumber(entry.hearts),
        queenSpades: entry.queenSpades === true,
        tenDiamonds: entry.tenDiamonds === true,
      };
    }
    return entries;
  }

  private normalizeHandEntries(value: unknown): Record<string, HandEntry> {
    const record = asRecord(value);
    const entries: Record<string, HandEntry> = {};
    if (!record) return entries;
    for (const [id, value] of Object.entries(record)) {
      const entry = asRecord(value);
      if (!entry) continue;
      const allowedFinishes: FinishType[] = ['none', 'normal', 'hand'];
      const finish = typeof entry.finish === 'string' && allowedFinishes.includes(entry.finish as FinishType)
        ? entry.finish as FinishType
        : 'none';
      entries[id] = { points: finiteNumber(entry.points), finish };
    }
    return entries;
  }

  private normalizeBidEntries(value: unknown): Record<string, BidEntry> {
    const record = asRecord(value);
    const entries: Record<string, BidEntry> = {};
    if (!record) return entries;
    for (const [id, value] of Object.entries(record)) {
      const entry = asRecord(value);
      if (!entry) continue;
      const allowedBids = this.bids.map((bid) => bid.value);
      const bid = typeof entry.bid === 'string' && allowedBids.includes(entry.bid as BidValue)
        ? entry.bid as BidValue
        : null;
      entries[id] = {
        bid,
        made: typeof entry.made === 'boolean' ? entry.made : null,
      };
    }
    return entries;
  }

  private persist(): void {
    localStorage.setItem(this.matchesStorageKey, JSON.stringify(this.matches));
    if (this.selectedMatchId) localStorage.setItem('l4ht.selected.v1', this.selectedMatchId);
    else localStorage.removeItem('l4ht.selected.v1');
  }

  newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  isContractGame(game: Game): boolean {
    return game === '400' || game === 'Tarneb';
  }

  ruleSummary(game: Game): string {
    switch (game) {
      case 'Leekha':
        return 'Hearts +1 · Queen of spades +13 · 10 of diamonds +10 · a tied 101+ score stays in';
      case 'Hand':
        return 'Enter round points, then choose no finish, finish (−30), or finish with hand (−60)';
      case '400':
      case 'Tarneb':
        return 'Choose each bid and mark it made or missed · first player to 41 wins if their partner is not negative';
    }
  }

  openNewMatch(): void {
    this.gameDraft = 'Leekha';
    this.dialog = 'new-match';
  }

  createMatch(): void {
    const match: Match = {
      id: this.newId(),
      game: this.gameDraft,
      createdAt: new Date().toISOString(),
      players: [],
      rounds: [],
      fullRoundValue: null,
      teamA: [null, null],
      teamB: [null, null],
    };
    this.matches = [match, ...this.matches];
    this.selectedMatchId = match.id;
    this.persist();
    this.dialog = 'add-player';
    this.nameDraft = '';
  }

  selectMatch(match: Match): void {
    this.selectedMatchId = match.id;
    this.persist();
  }

  backToMatches(): void {
    this.selectedMatchId = null;
    this.persist();
  }

  canAddPlayer(match: Match): boolean {
    return !this.isContractGame(match.game) || match.players.length < 4;
  }

  addPlayer(): void {
    const name = this.nameDraft.trim();
    const match = this.activeMatch;
    if (!name || !match || !this.canAddPlayer(match)) return;
    match.players.push({ id: this.newId(), name });
    this.nameDraft = '';
    this.dialog = null;
    this.persist();
  }

  openAddPlayer(): void {
    if (!this.activeMatch || !this.canAddPlayer(this.activeMatch)) return;
    this.nameDraft = '';
    this.editingPlayerId = null;
    this.dialog = 'add-player';
  }

  openRenamePlayer(player: Player): void {
    this.nameDraft = player.name;
    this.editingPlayerId = player.id;
    this.dialog = 'rename-player';
  }

  renamePlayer(): void {
    const player = this.activeMatch?.players.find((item) => item.id === this.editingPlayerId);
    const name = this.nameDraft.trim();
    if (!player || !name) return;
    player.name = name;
    this.dialog = null;
    this.persist();
  }

  requestRemovePlayer(player: Player): void {
    const hasHistory = (this.activeMatch?.rounds ?? []).some(
      (round) => round.entries[player.id] !== undefined,
    );
    this.askConfirm(
      `Remove ${player.name}?`,
      hasHistory
        ? 'This player has scores in this match. Removing them also removes their recorded cards, bids, and scores from every round.'
        : 'This player will be removed from the match.',
      () => {
        const match = this.activeMatch;
        if (!match) return;
        match.players = match.players.filter((item) => item.id !== player.id);
        for (const round of match.rounds) {
          delete round.entries[player.id];
          if (round.leekhaEntries) delete round.leekhaEntries[player.id];
          if (round.handEntries) delete round.handEntries[player.id];
          if (round.bidEntries) delete round.bidEntries[player.id];
        }
        match.teamA = match.teamA.map((id) => id === player.id ? null : id) as [string | null, string | null];
        match.teamB = match.teamB.map((id) => id === player.id ? null : id) as [string | null, string | null];
        this.persist();
      },
    );
  }

  getRoundKind(game: Game): RoundKind {
    if (game === 'Leekha') return 'leekha';
    if (game === 'Hand') return 'hand';
    return 'contract';
  }

  canAddRound(match: Match): boolean {
    if (!match.players.length) return false;
    if (this.isContractGame(match.game) && !this.hasValidTeams(match)) return false;
    if (this.matchHasWinner(match)) return false;
    if (match.game === 'Leekha' && this.getLeekhaEliminations(match).size === match.players.length) return false;
    const lastRound = match.rounds.at(-1);
    return !lastRound || this.isRoundComplete(match, lastRound);
  }

  addRound(): void {
    const match = this.activeMatch;
    if (!match || !this.canAddRound(match)) return;
    const round: Round = {
      id: this.newId(),
      label: `Round ${match.rounds.length + 1}`,
      kind: this.getRoundKind(match.game),
      entries: {},
      leekhaEntries: {},
      handEntries: {},
      bidEntries: {},
    };
    match.rounds.push(round);
    this.persist();
  }

  isRoundComplete(match: Match, round: Round): boolean {
    if (round.kind === 'legacy') return true;
    const players = match.players.filter((player) =>
      round.kind !== 'leekha' || !this.isPlayerOutBeforeRound(match, round, player.id),
    );
    if (!players.length) return true;

    if (round.kind === 'leekha') {
      return players.every((player) => {
        const entry = round.leekhaEntries?.[player.id];
        return entry !== undefined && (
          entry.hearts !== null || entry.queenSpades || entry.tenDiamonds
        );
      });
    }
    if (round.kind === 'hand') {
      return players.every((player) => {
        const entry = round.handEntries?.[player.id];
        return entry !== undefined && (entry.points !== null || entry.finish !== 'none');
      });
    }
    return players.every((player) => {
      const entry = round.bidEntries?.[player.id];
      return entry?.bid !== null && entry?.bid !== undefined
        && entry.made !== null
        && (entry.bid !== 'full' || match.fullRoundValue !== null);
    });
  }

  getRoundCompletionHint(match: Match): string {
    if (!match.players.length) return 'Add players before starting a round.';
    if (this.isContractGame(match.game) && !this.hasValidTeams(match)) {
      return 'Add four players and assign both pairs before starting a round.';
    }
    const lastRound = match.rounds.at(-1);
    if (lastRound && !this.isRoundComplete(match, lastRound)) {
      return 'Finish every player’s entry in this round before adding the next.';
    }
    return '';
  }

  openEditRound(round: Round): void {
    this.editingRoundId = round.id;
    this.roundLabelDraft = round.label;
    this.dialog = 'round';
  }

  saveRoundLabel(): void {
    const round = this.activeMatch?.rounds.find((item) => item.id === this.editingRoundId);
    const label = this.roundLabelDraft.trim();
    if (!round || !label) return;
    round.label = label;
    this.dialog = null;
    this.persist();
  }

  requestDeleteRound(round: Round): void {
    this.askConfirm(
      `Delete ${round.label}?`,
      'This round and all of its card selections, bids, and scores will be removed.',
      () => {
        const match = this.activeMatch;
        if (!match) return;
        match.rounds = match.rounds.filter((item) => item.id !== round.id);
        this.persist();
      },
    );
  }

  setScore(round: Round, playerId: string, rawValue: string): void {
    const score = finiteNumber(rawValue);
    if (score === null) delete round.entries[playerId];
    else round.entries[playerId] = score;
    this.persist();
  }

  getLeekhaEntry(round: Round, playerId: string): LeekhaEntry | undefined {
    return round.leekhaEntries?.[playerId];
  }

  totalHearts(round: Round): number {
    return Object.values(round.leekhaEntries ?? {}).reduce(
      (sum, entry) => sum + (entry.hearts ?? 0),
      0,
    );
  }

  availableHearts(round: Round, playerId: string): number {
    const usedByOthers = Object.entries(round.leekhaEntries ?? {}).reduce(
      (sum, [id, entry]) => id === playerId ? sum : sum + (entry.hearts ?? 0),
      0,
    );
    return Math.max(0, 13 - usedByOthers);
  }

  canClaimSpecialCard(round: Round, playerId: string, card: SpecialCard): boolean {
    return !Object.entries(round.leekhaEntries ?? {}).some(
      ([id, entry]) => id !== playerId && entry[card],
    );
  }

  setLeekhaHearts(round: Round, playerId: string, rawValue: string): void {
    const entry = this.ensureLeekhaEntry(round, playerId);
    const parsed = finiteNumber(rawValue);
    entry.hearts = parsed === null
      ? null
      : Math.max(0, Math.min(this.availableHearts(round, playerId), Math.floor(parsed)));
    this.updateLeekhaScore(round, playerId);
    this.persist();
  }

  setLeekhaCard(round: Round, playerId: string, card: SpecialCard, selected: boolean): void {
    if (selected && !this.canClaimSpecialCard(round, playerId, card)) return;
    const entry = this.ensureLeekhaEntry(round, playerId);
    entry[card] = selected;
    this.updateLeekhaScore(round, playerId);
    this.persist();
  }

  private ensureLeekhaEntry(round: Round, playerId: string): LeekhaEntry {
    round.leekhaEntries ??= {};
    round.leekhaEntries[playerId] ??= {
      hearts: null,
      queenSpades: false,
      tenDiamonds: false,
    };
    return round.leekhaEntries[playerId];
  }

  private updateLeekhaScore(round: Round, playerId: string): void {
    const entry = round.leekhaEntries?.[playerId];
    if (!entry || (entry.hearts === null && !entry.queenSpades && !entry.tenDiamonds)) {
      delete round.entries[playerId];
      return;
    }
    round.entries[playerId] = (entry.hearts ?? 0)
      + (entry.queenSpades ? 13 : 0)
      + (entry.tenDiamonds ? 10 : 0);
  }

  getHandEntry(round: Round, playerId: string): HandEntry | undefined {
    return round.handEntries?.[playerId];
  }

  setHandPoints(round: Round, playerId: string, rawValue: string): void {
    const entry = this.ensureHandEntry(round, playerId);
    entry.points = finiteNumber(rawValue);
    this.updateHandScore(round, playerId);
    this.persist();
  }

  setHandFinish(round: Round, playerId: string, finish: FinishType): void {
    const entry = this.ensureHandEntry(round, playerId);
    entry.finish = finish;
    this.updateHandScore(round, playerId);
    this.persist();
  }

  private ensureHandEntry(round: Round, playerId: string): HandEntry {
    round.handEntries ??= {};
    round.handEntries[playerId] ??= { points: null, finish: 'none' };
    return round.handEntries[playerId];
  }

  private updateHandScore(round: Round, playerId: string): void {
    const entry = round.handEntries?.[playerId];
    if (!entry || (entry.points === null && entry.finish === 'none')) {
      delete round.entries[playerId];
      return;
    }
    const finishPenalty = entry.finish === 'normal' ? -30 : entry.finish === 'hand' ? -60 : 0;
    round.entries[playerId] = (entry.points ?? 0) + finishPenalty;
  }

  setFullRoundValue(match: Match, rawValue: string): void {
    const value = finiteNumber(rawValue);
    const wholeValue = value === null ? null : Math.floor(value);
    match.fullRoundValue = wholeValue !== null && wholeValue > 0 ? wholeValue : null;
    for (const round of match.rounds) {
      if (round.kind === 'contract') {
        for (const player of match.players) this.updateBidScore(match, round, player.id);
      }
    }
    this.persist();
  }

  getBidEntry(round: Round, playerId: string): BidEntry | undefined {
    return round.bidEntries?.[playerId];
  }

  setBid(match: Match, round: Round, playerId: string, rawValue: string): void {
    const bid = this.bids.some((item) => item.value === rawValue) ? rawValue as BidValue : null;
    round.bidEntries ??= {};
    round.bidEntries[playerId] = { bid, made: null };
    this.updateBidScore(match, round, playerId);
    this.persist();
  }

  canMarkBid(match: Match, round: Round, playerId: string): boolean {
    const entry = round.bidEntries?.[playerId];
    return entry?.bid !== null && entry?.bid !== undefined
      && (entry.bid !== 'full' || match.fullRoundValue !== null);
  }

  setBidOutcome(match: Match, round: Round, playerId: string, made: boolean): void {
    if (!this.canMarkBid(match, round, playerId)) return;
    const entry = round.bidEntries?.[playerId];
    if (!entry) return;
    entry.made = made;
    this.updateBidScore(match, round, playerId);
    this.persist();
  }

  bidPoints(match: Match, entry: BidEntry | undefined): number | null {
    if (!entry?.bid) return null;
    if (entry.bid === 'full') return match.fullRoundValue;
    return Number(entry.bid);
  }

  private updateBidScore(match: Match, round: Round, playerId: string): void {
    const entry = round.bidEntries?.[playerId];
    const points = this.bidPoints(match, entry);
    if (!entry || entry.made === null || points === null) {
      delete round.entries[playerId];
      return;
    }
    round.entries[playerId] = entry.made ? points : -points;
  }

  teamPlayerId(match: Match, team: TeamName, index: 0 | 1): string {
    return (team === 'A' ? match.teamA : match.teamB)[index] ?? '';
  }

  isTeamSlotTaken(match: Match, playerId: string, team: TeamName, index: 0 | 1): boolean {
    if (!playerId) return false;
    const slots: Array<{ team: TeamName; index: 0 | 1; playerId: string | null }> = [
      { team: 'A', index: 0, playerId: match.teamA[0] },
      { team: 'A', index: 1, playerId: match.teamA[1] },
      { team: 'B', index: 0, playerId: match.teamB[0] },
      { team: 'B', index: 1, playerId: match.teamB[1] },
    ];
    return slots.some((slot) =>
      slot.team !== team || slot.index !== index
        ? slot.playerId === playerId
        : false,
    );
  }

  setTeamPlayer(match: Match, team: TeamName, index: 0 | 1, playerId: string): void {
    const pair = team === 'A' ? match.teamA : match.teamB;
    if (playerId && this.isTeamSlotTaken(match, playerId, team, index)) return;
    pair[index] = playerId || null;
    this.persist();
  }

  hasValidTeams(match: Match): boolean {
    const selected = [...match.teamA, ...match.teamB];
    return match.players.length === 4
      && selected.every((id): id is string => id !== null && match.players.some((player) => player.id === id))
      && new Set(selected).size === 4;
  }

  getWinner(match: Match): TeamWin | null {
    if (!this.isContractGame(match.game) || !this.hasValidTeams(match)) return null;
    const totals: Record<string, number> = Object.fromEntries(
      match.players.map((player) => [player.id, 0]),
    );
    for (const round of match.rounds) {
      for (const player of match.players) {
        totals[player.id] += Number(round.entries[player.id]) || 0;
      }
      if (!this.isRoundComplete(match, round)) break;
      const winningTeams: TeamName[] = [];
      for (const team of ['A', 'B'] as const) {
        const pair = team === 'A' ? match.teamA : match.teamB;
        if (pair.some((playerId, index) => {
          const partnerId = pair[index === 0 ? 1 : 0];
          return !!playerId && !!partnerId && totals[playerId] >= 41 && totals[partnerId] >= 0;
        })) {
          winningTeams.push(team);
        }
      }
      if (winningTeams.length) return { teams: winningTeams, roundLabel: round.label };
    }
    return null;
  }

  matchHasWinner(match: Match): boolean {
    if (match.game === 'Leekha') {
      return this.getLeekhaWinner(match) !== null
        || (match.players.length > 0 && this.getLeekhaEliminations(match).size === match.players.length);
    }
    return this.getWinner(match) !== null;
  }

  getTeamWinMessage(match: Match): string {
    const winner = this.getWinner(match);
    if (!winner) return '';
    if (winner.teams.length > 1) {
      return `Both pairs met the win condition in ${winner.roundLabel}.`;
    }
    return `Team ${winner.teams[0]} wins in ${winner.roundLabel}: a player reached 41 with their partner at 0 or above.`;
  }

  private calculateTotals(match: Match): Record<string, number> {
    const total: Record<string, number> = {};
    for (const player of match.players) {
      total[player.id] = match.rounds.reduce(
        (sum, round) => sum + (Number(round.entries[player.id]) || 0),
        0,
      );
    }
    return total;
  }

  private getLeekhaEliminations(match: Match): Map<string, LeekhaElimination> {
    const totals: Record<string, number> = Object.fromEntries(
      match.players.map((player) => [player.id, 0]),
    );
    const active = new Set(match.players.map((player) => player.id));
    const eliminated = new Map<string, LeekhaElimination>();

    for (const [roundIndex, round] of match.rounds.entries()) {
      for (const playerId of active) {
        totals[playerId] += Number(round.entries[playerId]) || 0;
      }

      if (round.kind === 'leekha' && [...active].some((playerId) => {
        const entry = round.leekhaEntries?.[playerId];
        return !entry || (
          (entry.hearts === null || entry.hearts === undefined)
          && !entry.queenSpades
          && !entry.tenDiamonds
        );
      })) break;

      const atThreshold = [...active].filter((playerId) => totals[playerId] >= 101);
      const scoreCounts = new Map<number, number>();
      for (const playerId of active) {
        const score = totals[playerId];
        scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1);
      }
      for (const playerId of atThreshold) {
        const score = totals[playerId];
        if (scoreCounts.get(score) === 1) {
          eliminated.set(playerId, {
            roundId: round.id,
            roundLabel: round.label,
            roundIndex,
            total: score,
          });
        }
      }
      for (const playerId of eliminated.keys()) {
        if (eliminated.get(playerId)?.roundIndex === roundIndex) active.delete(playerId);
      }
    }
    return eliminated;
  }

  getLeekhaWinner(match: Match): Player | null {
    if (match.game !== 'Leekha') return null;
    const eliminated = this.getLeekhaEliminations(match);
    const remaining = match.players.filter((player) => !eliminated.has(player.id));
    return remaining.length === 1 ? remaining[0] : null;
  }

  isPlayerOutBeforeRound(match: Match, round: Round, playerId: string): boolean {
    if (match.game !== 'Leekha') return false;
    const currentIndex = match.rounds.findIndex((item) => item.id === round.id);
    const elimination = this.getLeekhaEliminations(match).get(playerId);
    return !!elimination && elimination.roundIndex < currentIndex;
  }

  getLeekhaElimination(match: Match, playerId: string): LeekhaElimination | undefined {
    return this.getLeekhaEliminations(match).get(playerId);
  }

  getLeekhaStatusMessage(match: Match): string {
    const winner = this.getLeekhaWinner(match);
    if (winner) return `${winner.name} is the last player in.`;
    const outCount = this.getLeekhaEliminations(match).size;
    if (match.players.length > 0 && outCount === match.players.length) {
      return 'All players are out at 101+; there is no remaining player.';
    }
    return outCount ? `${outCount} ${outCount === 1 ? 'player is' : 'players are'} out. Tied 101+ scores stay in.` : '';
  }

  isLegacy(round: Round): boolean {
    return round.kind === 'legacy';
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
  }

  requestDeleteMatch(match: Match, event?: Event): void {
    event?.stopPropagation();
    this.askConfirm(
      'Delete this match?',
      `“${match.game}” and its ${match.rounds.length} ${match.rounds.length === 1 ? 'round' : 'rounds'} will be permanently removed from this device.`,
      () => {
        this.matches = this.matches.filter((item) => item.id !== match.id);
        if (this.selectedMatchId === match.id) this.selectedMatchId = null;
        this.persist();
      },
    );
  }

  private askConfirm(title: string, message: string, action: () => void): void {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmAction = action;
    this.dialog = 'confirm';
  }

  confirm(): void {
    this.confirmAction?.();
    this.confirmAction = null;
    this.dialog = null;
  }

  cancelDialog(): void {
    this.dialog = null;
    this.confirmAction = null;
  }
}