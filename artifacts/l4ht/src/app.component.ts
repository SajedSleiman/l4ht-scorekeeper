import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Player {
  id: string;
  name: string;
}

interface Round {
  id: string;
  label: string;
  entries: Record<string, number | undefined>;
}

interface Match {
  id: string;
  game: string;
  createdAt: string;
  players: Player[];
  rounds: Round[];
}

type DialogKind = 'new-match' | 'add-player' | 'rename-player' | 'round' | 'confirm' | null;

@Component({
  selector: 'l4ht-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  readonly games = ['Leekha', 'Hand', '400', 'Tarneb'];
  matches: Match[] = [];
  selectedMatchId: string | null = null;
  dialog: DialogKind = null;
  gameDraft = 'Leekha';
  nameDraft = '';
  roundLabelDraft = '';
  editingPlayerId: string | null = null;
  editingRoundId: string | null = null;
  confirmTitle = '';
  confirmMessage = '';
  private confirmAction: (() => void) | null = null;

  ngOnInit(): void {
    try {
      const saved = localStorage.getItem('l4ht.matches.v1');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) this.matches = parsed as Match[];
      }
      const lastMatch = localStorage.getItem('l4ht.selected.v1');
      if (lastMatch && this.matches.some((match) => match.id === lastMatch)) {
        this.selectedMatchId = lastMatch;
      }
    } catch {
      this.matches = [];
    }
  }

  get activeMatch(): Match | undefined {
    return this.matches.find((match) => match.id === this.selectedMatchId);
  }

  get totals(): Record<string, number> {
    const total: Record<string, number> = {};
    for (const player of this.activeMatch?.players ?? []) {
      total[player.id] = (this.activeMatch?.rounds ?? []).reduce(
        (sum, round) => sum + (Number(round.entries[player.id]) || 0),
        0,
      );
    }
    return total;
  }

  getMatchTotal(match: Match): number {
    return match.rounds.length;
  }

  newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private persist(): void {
    localStorage.setItem('l4ht.matches.v1', JSON.stringify(this.matches));
    if (this.selectedMatchId) localStorage.setItem('l4ht.selected.v1', this.selectedMatchId);
    else localStorage.removeItem('l4ht.selected.v1');
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

  addPlayer(): void {
    const name = this.nameDraft.trim();
    const match = this.activeMatch;
    if (!name || !match) return;
    match.players.push({ id: this.newId(), name });
    this.nameDraft = '';
    this.dialog = null;
    this.persist();
  }

  openAddPlayer(): void {
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
        ? 'This player has scores in this match. Removing them will also remove those scores from every round.'
        : 'This player will be removed from the match.',
      () => {
        const match = this.activeMatch;
        if (!match) return;
        match.players = match.players.filter((item) => item.id !== player.id);
        for (const round of match.rounds) delete round.entries[player.id];
        this.persist();
      },
    );
  }

  addRound(): void {
    const match = this.activeMatch;
    if (!match) return;
    match.rounds.push({
      id: this.newId(),
      label: `Round ${match.rounds.length + 1}`,
      entries: {},
    });
    this.persist();
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
      'This round and all of its entered scores will be removed.',
      () => {
        const match = this.activeMatch;
        if (!match) return;
        match.rounds = match.rounds.filter((item) => item.id !== round.id);
        this.persist();
      },
    );
  }

  setScore(round: Round, playerId: string, rawValue: string): void {
    const clean = rawValue.trim();
    if (!clean) {
      delete round.entries[playerId];
    } else {
      const score = Number(clean);
      if (Number.isFinite(score)) round.entries[playerId] = score;
    }
    this.persist();
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

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
  }
}