import { CommonModule } from '@angular/common';
import { Component, OnInit,ViewChild,ElementRef} from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Player {
  id: string;
  name: string;
}


type Bid = number | 'full';

type BidResult = 'made' | 'missed';

interface Round {
  id: string;
  label: string;

  /*
   * Used by Hand.
   * Also kept for backwards compatibility with
   * your previous version.
   */
  entries: Record<string, number | undefined>;

  /*
   * Used by Leekha.
   * Number of hearts eaten by each player.
   */
  hearts?: Record<string, number | undefined>;

  /*
   * Exactly one player can own each card.
   */
  queenPlayerId?: string;
  tenDiamondPlayerId?: string;

  /*
   * Used by 400 / Tarneeb.
   */
  bids?: Record<string, Bid | undefined>;

  bidResults?: Record<string, BidResult | undefined>;

  /*
   * Used by Hand.
   */
  finishedPlayerId?: string;
  finishedWithHand?: boolean;
  biddingTeam?: number;      // 0 = Team 1, 1 = Team 2
  bidAmount?: number;        // 7 to 13
  bidMade?: boolean;         // true = Made (+bid), false = Missed (-bid)
  opponentTricks?: number;
}

interface Match {
  id: string;
  game: string;
  createdAt: string;

  players: Player[];
  rounds: Round[];

  /*
   * Only relevant to Leekha.
   */
  leekhaPartners?: boolean;

  finished?: boolean;
  winnerMessage?: string;
}

type DialogKind =
  | 'new-match'
  | 'add-player'
  | 'rename-player'
  | 'round'
  | 'confirm'
  | null;

@Component({
  selector: 'l4ht-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
showWinVideo = false;
@ViewChild('winVideo') winVideoRef!: ElementRef<HTMLVideoElement>;
  readonly games = [
    'Leekha',
    'Hand',
    '400',
    'Tarneb',
  ];

  readonly normalBids = [
    2,
    3,
    4,
    10,
    12,
    14,
    16,
    18,
    27,
  ];

  matches: Match[] = [];

  selectedMatchId: string | null = null;

  dialog: DialogKind = null;

  gameDraft = 'Leekha';

  nameDraft = '';

  roundLabelDraft = '';

  editingPlayerId: string | null = null;

  editingRoundId: string | null = null;

  selectedRoundIndex = 0;

  expanded = false;

  confirmTitle = '';

  confirmMessage = '';

  private confirmAction: (() => void) | null = null;

  leekhaPartners = true;


  // ============================================================
  // INIT
  // ============================================================

  ngOnInit(): void {

    try {

      const saved =
        localStorage.getItem(
          'l4ht.matches.v1',
        );

      if (saved) {

        const parsed: unknown =
          JSON.parse(saved);

        if (Array.isArray(parsed)) {
          this.matches =
            parsed as Match[];
        }

      }


      const lastMatch =
        localStorage.getItem(
          'l4ht.selected.v1',
        );

      if (
        lastMatch &&
        this.matches.some(
          match =>
            match.id === lastMatch,
        )
      ) {

        this.selectedMatchId =
          lastMatch;

      }


      /*
       * Upgrade older saved data.
       */
      for (const match of this.matches) {

        if (
          match.game === 'Leekha' &&
          match.leekhaPartners === undefined
        ) {
          match.leekhaPartners = true;
        }


        for (const round of match.rounds) {

          if (!round.entries) {
            round.entries = {};
          }


          if (
            match.game === 'Leekha' &&
            !round.hearts
          ) {
            round.hearts = {};
          }


          if (
            (
              match.game === '400' ||
              match.game === 'Tarneb'
            ) &&
            !round.bids
          ) {
            round.bids = {};
          }


          if (
            (
              match.game === '400' ||
              match.game === 'Tarneb'
            ) &&
            !round.bidResults
          ) {
            round.bidResults = {};
          }

        }

      }


      this.persist();

    } catch {

      this.matches = [];

    }

  }


  // ============================================================
  // GETTERS
  // ============================================================

  get activeMatch(): Match | undefined {

    return this.matches.find(
      match =>
        match.id ===
        this.selectedMatchId,
    );

  }


  get totals(): Record<string, number> {

    const total:
      Record<string, number> = {};

    const match =
      this.activeMatch;

    if (!match) {
      return total;
    }


    for (const player of match.players) {

      total[player.id] =
        match.rounds.reduce(
          (sum, round) =>
            sum +
            this.roundScore(
              match,
              round,
              player.id,
            ),
          0,
        );

    }


    return total;

  }


  get roundIdx(): number {

    const count =
      this.activeMatch
        ?.rounds.length ?? 0;

    return Math.min(
      Math.max(
        this.selectedRoundIndex,
        0,
      ),
      Math.max(
        count - 1,
        0,
      ),
    );

  }


  get currentRound(): Round | undefined {

    return this.activeMatch
      ?.rounds[this.roundIdx];

  }


  // ============================================================
  // ID / STORAGE
  // ============================================================

  newId(): string {

    return typeof crypto !== 'undefined' &&
      'randomUUID' in crypto

      ? crypto.randomUUID()

      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`;

  }


  private persist(): void {

    localStorage.setItem(
      'l4ht.matches.v1',
      JSON.stringify(this.matches),
    );


    if (this.selectedMatchId) {

      localStorage.setItem(
        'l4ht.selected.v1',
        this.selectedMatchId,
      );

    } else {

      localStorage.removeItem(
        'l4ht.selected.v1',
      );

    }

  }


  // ============================================================
  // MATCH CREATION
  // ============================================================

  openNewMatch(): void {

    this.gameDraft = 'Leekha';

    this.leekhaPartners = true;

    this.dialog = 'new-match';

  }


  createMatch(): void {

    const match: Match = {

      id: this.newId(),

      game: this.gameDraft,

      createdAt:
        new Date().toISOString(),

      players: [],

      rounds: [],

      leekhaPartners:
        this.gameDraft === 'Leekha'
          ? this.leekhaPartners
          : undefined,

      finished: false,

    };


    this.matches = [
      match,
      ...this.matches,
    ];


    this.selectedMatchId =
      match.id;

    this.selectedRoundIndex = 0;

    this.expanded = false;

    this.persist();


    this.dialog = 'add-player';

    this.nameDraft = '';

  }


  selectMatch(match: Match): void {

    this.selectedMatchId =
      match.id;

    this.selectedRoundIndex =
      Math.max(
        match.rounds.length - 1,
        0,
      );

    this.expanded = false;

    this.persist();

  }


  backToMatches(): void {

    this.selectedMatchId = null;

    this.expanded = false;

    this.persist();

  }


  // ============================================================
  // PLAYER COUNT
  // ============================================================

  canAddPlayer(
    match: Match,
  ): boolean {

    return match.players.length < 4;

  }


  correctPlayerCount(
    match: Match,
  ): boolean {

    if (match.game === 'Hand') {

      return (
        match.players.length >= 2 &&
        match.players.length <= 4
      );

    }


    return match.players.length === 4;

  }


  // ============================================================
  // PLAYERS
  // ============================================================

  addPlayer(): void {

    const match =
      this.activeMatch;

    const name =
      this.nameDraft.trim();

    if (!match || !name) {
      return;
    }


    if (!this.canAddPlayer(match)) {
      return;
    }


    match.players.push({

      id: this.newId(),

      name,

    });


    this.nameDraft = '';

    this.dialog = null;

    this.persist();

  }


  openAddPlayer(): void {

    const match =
      this.activeMatch;

    if (
      !match ||
      !this.canAddPlayer(match)
    ) {
      return;
    }


    this.nameDraft = '';

    this.editingPlayerId = null;

    this.dialog =
      'add-player';

  }


  openRenamePlayer(
    player: Player,
  ): void {

    this.nameDraft =
      player.name;

    this.editingPlayerId =
      player.id;

    this.dialog =
      'rename-player';

  }


  renamePlayer(): void {

    const player =
      this.activeMatch?.players.find(
        item =>
          item.id ===
          this.editingPlayerId,
      );

    const name =
      this.nameDraft.trim();

    if (!player || !name) {
      return;
    }


    player.name = name;

    this.dialog = null;

    this.persist();

  }


  requestRemovePlayer(
    player: Player,
  ): void {

    this.askConfirm(

      `Remove ${player.name}?`,

      'This player will be removed from the match and their scores will be removed from every round.',

      () => {

        const match =
          this.activeMatch;

        if (!match) {
          return;
        }


        match.players =
          match.players.filter(
            item =>
              item.id !== player.id,
          );


        for (
          const round
          of match.rounds
        ) {

          delete round.entries[player.id];

          if (round.hearts) {
            delete round.hearts[player.id];
          }

          if (round.bids) {
            delete round.bids[player.id];
          }

          if (round.bidResults) {
            delete round.bidResults[player.id];
          }


          if (
            round.finishedPlayerId ===
            player.id
          ) {
            round.finishedPlayerId =
              undefined;
          }


          if (
            round.queenPlayerId ===
            player.id
          ) {
            round.queenPlayerId =
              undefined;
          }


          if (
            round.tenDiamondPlayerId ===
            player.id
          ) {
            round.tenDiamondPlayerId =
              undefined;
          }

        }


        this.persist();

      },

    );

  }


  // ============================================================
  // ROUND CREATION
  // ============================================================

  canStartRound(
    match: Match,
  ): boolean {

    if (match.finished) {
      return false;
    }


    if (!this.correctPlayerCount(match)) {
      return false;
    }


    if (
      match.game === 'Hand' &&
      match.rounds.length >= 7
    ) {
      return false;
    }


    if (match.rounds.length) {

      const previous =
        match.rounds[
          match.rounds.length - 1
        ];


      if (
        !this.roundComplete(
          match,
          previous,
        )
      ) {
        return false;
      }

    }


    return true;

  }


  addRound(): void {

    const match =
      this.activeMatch;

    if (
      !match ||
      !this.canStartRound(match)
    ) {
      return;
    }


    /*
     * Finalize the previous round.
     */
    if (match.rounds.length) {

      const previous =
        match.rounds[
          match.rounds.length - 1
        ];

      this.finalizeRound(
        match,
        previous,
      );

    }


    const round: Round = {

      id: this.newId(),

      label:
        `Round ${match.rounds.length + 1}`,

      entries: {},

    };


    if (match.game === 'Leekha') {

      round.hearts = {};

    }


    if (
      match.game === '400' ||
      match.game === 'Tarneb'
    ) {

      round.bids = {};

      round.bidResults = {};

    }


    if (match.game === 'Hand') {

      round.finishedWithHand =
        false;

    }


    match.rounds.push(round);


    this.selectedRoundIndex =
      match.rounds.length - 1;

    this.expanded = false;

    this.persist();

  }


  // ============================================================
  // ROUND FINALIZATION
  // ============================================================

  finalizeRound(
    match: Match,
    round: Round,
  ): void {

    /*
     * 400/Tarneb scores are calculated dynamically
     * from bid + Made/Missed, so no mutation is needed.
     */

    this.checkGameWinner(match);

    this.persist();

  }


  // ============================================================
  // ROUND VALIDATION
  // ============================================================
roundComplete(match: Match, round: Round): boolean {
  if (match.game === 'Leekha') return this.leekhaRoundComplete(match, round);
  if (match.game === '400') return this.trickRoundComplete(match, round);
  if (match.game === 'Tarneb') return this.tarneebRoundComplete(match, round);
  if (match.game === 'Hand') return this.handRoundComplete(match, round);
  return false;
}


  // ============================================================
  // LEEKHA
  // ============================================================



  leekhaRoundTotal(
    round: Round,
  ): number {

    return (
      this.totalHearts(round) +
      (round.queenPlayerId ? 13 : 0) +
      (round.tenDiamondPlayerId ? 10 : 0)
    );

  }






  toggleQueen(
    round: Round,
    playerId: string,
  ): void {

    /*
     * Only ONE player can have Q♠.
     *
     * Clicking the selected player again
     * removes the card.
     */

    if (
      round.queenPlayerId ===
      playerId
    ) {

      round.queenPlayerId =
        undefined;

    } else {

      round.queenPlayerId =
        playerId;

    }


    this.persist();

  }


  toggleTenDiamond(
    round: Round,
    playerId: string,
  ): void {

    /*
     * Only ONE player can have 10♦.
     */

    if (
      round.tenDiamondPlayerId ===
      playerId
    ) {

      round.tenDiamondPlayerId =
        undefined;

    } else {

      round.tenDiamondPlayerId =
        playerId;

    }


    this.persist();

  }


  leekhaRoundComplete(
    match: Match,
    round: Round,
  ): boolean {

    if (match.players.length !== 4) {
      return false;
    }


    /*
     * Exactly one Q♠.
     */
    if (!round.queenPlayerId) {
      return false;
    }


    /*
     * Exactly one 10♦.
     */
    if (!round.tenDiamondPlayerId) {
      return false;
    }


    /*
     * Exactly 13 Hearts.
     */
    if (this.totalHearts(round) !== 13) {
      return false;
    }


    /*
     * Therefore:
     * 13 Hearts + 13 Q♠ + 10♦ = 36.
     */
    return this.leekhaRoundTotal(round) === 36;

  }


  // ============================================================
  // 400 / TARNEB
  // ============================================================

availableBids(player: Player): (number | 'full')[] {
  const match = this.activeMatch;
  if (match?.game === 'Tarneb') {
    return [7, 8, 9, 10, 11, 12, 13, 'full'];
  }
  const minimum = this.minimumBid(player);
  return this.normalBids.filter(bid => bid >= minimum);
}


  minimumBid(
    player: Player,
  ): number {

    const score =
      this.totals[player.id] || 0;


    if (score >= 90) {
      return 18;
    }

    if (score >= 80) {
      return 16;
    }

    if (score >= 70) {
      return 14;
    }

    if (score >= 60) {
      return 12;
    }

    if (score >= 50) {
      return 10;
    }

    if (score >= 40) {
      return 4;
    }

    if (score >= 30) {
      return 3;
    }

    return 2;

  }


  getBid(
    round: Round,
    playerId: string,
  ): Bid | undefined {

    return round.bids?.[playerId];

  }


  bidValue(
    round: Round,
    playerId: string,
  ): string {

    const bid =
      this.getBid(
        round,
        playerId,
      );


    if (bid === undefined) {
      return '';
    }


    if (bid === 'full') {
      return 'full';
    }


    return String(bid);

  }


  setBidFromInput(
    round: Round,
    playerId: string,
    rawValue: string,
  ): void {

    if (!round.bids) {
      round.bids = {};
    }


    if (!rawValue) {

      delete round.bids[playerId];

      if (round.bidResults) {
        delete round.bidResults[playerId];
      }

      this.persist();

      return;

    }


    if (rawValue === 'full') {

      round.bids[playerId] =
        'full';

      this.persist();

      return;

    }


    const value =
      Number(rawValue);


    if (
      !Number.isFinite(value)
    ) {
      return;
    }


    const player =
      this.activeMatch?.players.find(
        item =>
          item.id === playerId,
      );


    if (!player) {
      return;
    }


    const minimum =
      this.minimumBid(player);


    if (value < minimum) {
      return;
    }


    if (
      !this.normalBids.includes(value)
    ) {
      return;
    }


    round.bids[playerId] =
      value;

    this.persist();

  }


  bidResult(
    round: Round,
    playerId: string,
  ): BidResult | undefined {

    return round.bidResults?.[playerId];

  }


  setBidResult(
    round: Round,
    playerId: string,
    result: BidResult,
  ): void {

    const bid =
      this.getBid(
        round,
        playerId,
      );


    /*
     * Cannot mark Made/Missed until
     * the player has a bid.
     */
    if (bid === undefined) {
      return;
    }


    if (!round.bidResults) {
      round.bidResults = {};
    }


    /*
     * Clicking the same result again
     * clears it.
     */
    if (
      round.bidResults[playerId] ===
      result
    ) {

      delete round.bidResults[playerId];

    } else {

      round.bidResults[playerId] =
        result;

    }


    this.persist();


    this.checkGameWinner(
      this.activeMatch!,
    );

  }


  trickRoundComplete(
    match: Match,
    round: Round,
  ): boolean {

    if (match.players.length !== 4) {
      return false;
    }


    if (!round.bids) {
      return false;
    }


    if (!round.bidResults) {
      return false;
    }


    for (const player of match.players) {

      if (
        round.bids[player.id] ===
        undefined
      ) {
        return false;
      }


      if (
        round.bidResults[player.id] ===
        undefined
      ) {
        return false;
      }

    }


    return true;

  }


  // ============================================================
  // HAND
  // ============================================================

  isMatchFinished(match: Match, currentRound: Round): boolean {
  // 1. Check if the current round is valid and complete
  if (!this.handRoundComplete(match, currentRound)) {
    return false;
  }

  // 2. Check if this round is the final round of the match
  const isLastRound =
    match.rounds.length > 0 &&
    currentRound.id === match.rounds[match.rounds.length - 1]?.id;

  return isLastRound;
}

setHandFinishedPlayer(
  round: Round,
  playerId: string,
): void {
  if (round.finishedPlayerId === playerId) {
    round.finishedPlayerId = undefined;
  } else {
    round.finishedPlayerId = playerId;
  }

  this.persist();

  // Only celebrate if this round completes the entire match / last round
  if (this.activeMatch && this.isMatchFinished(this.activeMatch, round)) {
    this.triggerWinCelebration(round);
  }
}

setHandFinishType(
  round: Round,
  withHand: boolean,
): void {
  if (!round.finishedPlayerId) {
    return;
  }

  round.finishedWithHand = withHand;
  this.persist();

  // Only celebrate if this round completes the entire match / last round
  if (this.activeMatch && this.isMatchFinished(this.activeMatch, round)) {
    this.triggerWinCelebration(round);
  }
}


  handRoundComplete(match: Match | null, round: Round | null): boolean {
  if (!match || !round) {
    return false;
  }
  
  if (match.players.length < 2 || match.players.length > 4) {
    return false;
  }

  if (!round.finishedPlayerId) {
    return false;
  }

  for (const player of match.players) {
    if (player.id === round.finishedPlayerId) {
      continue;
    }

    if (round.entries[player.id] === undefined) {
      return false;
    }

    if (Number(round.entries[player.id]) < 0) {
      return false;
    }
  }

  return true;
}
  setActual(round: Round, playerId: string, rawValue: any): void {
  // ... existing entry update logic ...
  this.persist();

  if (this.activeMatch && this.handRoundComplete(this.activeMatch, round)) {
    this.triggerWinCelebration();
  }
}

  private lastCelebratedRoundId: string | null = null;

triggerWinCelebration(round?: Round | null): void {
  if (round && this.lastCelebratedRoundId === round.id) {
    return;
  }

  if (round) {
    this.lastCelebratedRoundId = round.id;
  }

  this.showWinVideo = true;

  // Small delay to ensure #winVideo is rendered in the DOM by *ngIf
  setTimeout(() => {
    if (this.winVideoRef?.nativeElement) {
      const video = this.winVideoRef.nativeElement;
      video.muted = false;
      video.currentTime = 0;
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err: any) => {
          console.warn('Autoplay prevented by browser, playing muted as fallback:', err);
          video.muted = true;
          video.play();
        });
      }
    }
  }, 100);
}

  closeWinVideo(): void {
    if (this.winVideoRef?.nativeElement) {
      this.winVideoRef.nativeElement.pause();
    }
    this.showWinVideo = false;
  }



  // ============================================================
  // ROUND SCORE CALCULATION
  // ============================================================

  roundScore(
    match: Match,
    round: Round,
    playerId: string,
  ): number {

    /*
     * ---------------------------
     * LEEKHA
     * ---------------------------
     */

    if (match.game === 'Leekha') {

      return (
        this.heartsFor(
          round,
          playerId,
        ) +

        (
          round.queenPlayerId ===
          playerId
            ? 13
            : 0
        ) +

        (
          round.tenDiamondPlayerId ===
          playerId
            ? 10
            : 0
        )
      );

    }


    /*
     * ---------------------------
     * 400 / TARNEB
     * ---------------------------
     */

    if (
      match.game === '400' ||
      match.game === 'Tarneb'
    ) {

      const bid =
        this.getBid(
          round,
          playerId,
        );


      const result =
        this.bidResult(
          round,
          playerId,
        );


      if (
        bid === undefined ||
        result === undefined
      ) {
        return 0;
      }


      const value =
        bid === 'full'
          ? 27
          : bid;


      return result === 'made'
        ? value
        : -value;

    }


    /*
     * ---------------------------
     * HAND
     * ---------------------------
     */

    if (match.game === 'Hand') {

      if (
        round.finishedPlayerId ===
        playerId
      ) {

        return round.finishedWithHand
          ? -60
          : -30;

      }


      const value =
        Number(
          round.entries[playerId],
        ) || 0;


      return round.finishedWithHand
        ? value * 2
        : value;

    }


    return 0;

  }


  // ============================================================
  // GAME WINNERS
  // ============================================================

  checkGameWinner(
    match: Match,
  ): void {

    if (match.finished) {
      return;
    }


    if (match.game === 'Hand') {

      if (
        match.rounds.length < 7
      ) {
        return;
      }


      const totals =
        this.matchTotals(match);


      let winner:
        Player | undefined;


      for (const player of match.players) {

        if (!winner) {

          winner = player;

          continue;

        }


        if (
          (totals[player.id] || 0) <
          (totals[winner.id] || 0)
        ) {

          winner = player;

        }

      }


      if (winner) {

        match.finished = true;

        match.winnerMessage =
          `${winner.name} wins Hand with ${
            totals[winner.id] || 0
          } points.`;

        this.persist();

      }


      return;

    }


    if (
      match.game === '400' ||
      match.game === 'Tarneb'
    ) {

      this.checkPartnerGameWinner(
        match,
      );

      return;

    }


    if (match.game === 'Leekha') {

      this.checkLeekhaWinner(
        match,
      );

    }

  }


  checkPartnerGameWinner(
    match: Match,
  ): void {

    if (match.players.length !== 4) {
      return;
    }


    const totals =
      this.matchTotals(match);


    const teamA = [
      match.players[0],
      match.players[1],
    ];


    const teamB = [
      match.players[2],
      match.players[3],
    ];


    const teams = [
      teamA,
      teamB,
    ];


    for (const team of teams) {

      const first = team[0];
      const second = team[1];

      if (!first || !second) {
        continue;
      }


      const firstScore =
        totals[first.id] || 0;


      const secondScore =
        totals[second.id] || 0;


      const normalWin =
        (
          firstScore >= 41 &&
          secondScore >= 0
        ) ||
        (
          secondScore >= 41 &&
          firstScore >= 0
        );


      const fullGameWin =
        this.teamHasFullGameMade(
          match,
          team,
        );


      if (
        normalWin ||
        fullGameWin
      ) {

        match.finished = true;

        match.winnerMessage =
          `${first.name} & ${second.name} win ${match.game}.`;

        this.persist();

        return;

      }

    }

  }


  teamHasFullGameMade(
    match: Match,
    team: Player[],
  ): boolean {

    for (
      const round
      of match.rounds
    ) {

      for (
        const player
        of team
      ) {

        if (
          round.bids?.[player.id] ===
          'full' &&
          round.bidResults?.[player.id] ===
          'made'
        ) {

          return true;

        }

      }

    }


    return false;

  }


  checkLeekhaWinner(
    match: Match,
  ): void {

    if (match.players.length !== 4) {
      return;
    }


    const totals =
      this.matchTotals(match);


    /*
     * PARTNERS
     *
     * Team 1:
     * P1 + P2
     *
     * Team 2:
     * P3 + P4
     */
    if (match.leekhaPartners) {

      const teamA = [
        match.players[0],
        match.players[1],
      ];


      const teamB = [
        match.players[2],
        match.players[3],
      ];


      const teamAOut =
        teamA.some(
          player =>
            (totals[player.id] || 0) >= 101,
        );


      const teamBOut =
        teamB.some(
          player =>
            (totals[player.id] || 0) >= 101,
        );


      /*
       * Only one team has crossed 101.
       */
      if (
        teamAOut &&
        !teamBOut
      ) {

        match.finished = true;

        match.winnerMessage =
          `${teamB[0].name} & ${teamB[1].name} win Leekha.`;

        this.playLeekhaLossAudio();

        this.persist();

        return;

      }


      if (
        teamBOut &&
        !teamAOut
      ) {

        match.finished = true;

        match.winnerMessage =
          `${teamA[0].name} & ${teamA[1].name} win Leekha.`;

        this.playLeekhaLossAudio();

        this.persist();

        return;

      }


      /*
       * If both teams cross 101,
       * the game continues.
       *
       * This specifically preserves
       * your 105 vs 105 rule.
       */
      return;

    }


    /*
     * INDIVIDUAL LEEKHA
     */
    const alive =
      match.players.filter(
        player =>
          (totals[player.id] || 0) < 101,
      );


    if (alive.length === 1) {

      match.finished = true;

      match.winnerMessage =
        `${alive[0].name} wins Leekha.`;

      this.playLeekhaLossAudio();

      this.persist();

    }

  }


  // ============================================================
  // TOTALS
  // ============================================================

  matchTotals(
    match: Match,
  ): Record<string, number> {

    const total:
      Record<string, number> = {};


    for (
      const player
      of match.players
    ) {

      total[player.id] =
        match.rounds.reduce(
          (
            sum,
            round,
          ) =>
            sum +
            this.roundScore(
              match,
              round,
              player.id,
            ),
          0,
        );

    }


    return total;

  }


  // ============================================================
  // HAND / GENERAL SCORE INPUT
  // ============================================================

  setScore(
    round: Round,
    playerId: string,
    rawValue: string,
  ): void {

    const clean =
      rawValue.trim();


    if (!clean) {

      delete round.entries[playerId];

      this.persist();

      return;

    }


    const score =
      Number(clean);


    if (
      !Number.isFinite(score) ||
      score < 0
    ) {
      return;
    }


    round.entries[playerId] =
      Math.round(score);


    this.persist();

  }


  stepScore(
    round: Round,
    playerId: string,
    delta: number,
  ): void {

    const current =
      Number(
        round.entries[playerId],
      ) || 0;


    const next =
      Math.max(
        0,
        current + delta,
      );


    round.entries[playerId] =
      Math.round(next);


    this.persist();

  }


  // ============================================================
  // NAVIGATION
  // ============================================================

  prevRound(): void {

    this.selectedRoundIndex =
      Math.max(
        this.roundIdx - 1,
        0,
      );

  }


  nextRound(): void {

    const last =
      (
        this.activeMatch
          ?.rounds.length ?? 1
      ) - 1;


    this.selectedRoundIndex =
      Math.min(
        this.roundIdx + 1,
        last,
      );

  }


  goToRound(
    index: number,
  ): void {

    this.selectedRoundIndex =
      index;

    this.expanded = false;

  }


  // ============================================================
  // ROUND EDITING
  // ============================================================

  openEditRound(
    round: Round,
  ): void {

    this.editingRoundId =
      round.id;

    this.roundLabelDraft =
      round.label;

    this.dialog =
      'round';

  }


  saveRoundLabel(): void {

    const round =
      this.activeMatch?.rounds.find(
        item =>
          item.id ===
          this.editingRoundId,
      );


    const label =
      this.roundLabelDraft.trim();


    if (!round || !label) {
      return;
    }


    round.label = label;

    this.dialog = null;

    this.persist();

  }


  requestDeleteRound(
    round: Round,
  ): void {

    this.askConfirm(

      `Delete ${round.label}?`,

      'This round and all of its entered scores will be removed.',

      () => {

        const match =
          this.activeMatch;

        if (!match) {
          return;
        }


        match.rounds =
          match.rounds.filter(
            item =>
              item.id !== round.id,
          );


        match.finished = false;

        match.winnerMessage =
          undefined;


        this.selectedRoundIndex =
          Math.min(
            this.selectedRoundIndex,
            Math.max(
              match.rounds.length - 1,
              0,
            ),
          );


        this.persist();

      },

    );

  }


  // ============================================================
  // DELETE MATCH
  // ============================================================

  requestDeleteMatch(
    match: Match,
    event?: Event,
  ): void {

    event?.stopPropagation();


    this.askConfirm(

      'Delete this match?',

      `“${match.game}” and its ${match.rounds.length} ${
        match.rounds.length === 1
          ? 'round'
          : 'rounds'
      } will be permanently removed from this device.`,

      () => {

        this.matches =
          this.matches.filter(
            item =>
              item.id !== match.id,
          );


        if (
          this.selectedMatchId ===
          match.id
        ) {

          this.selectedMatchId =
            null;

        }


        this.persist();

      },

    );

  }


  // ============================================================
  // CONFIRM
  // ============================================================

  private askConfirm(
    title: string,
    message: string,
    action: () => void,
  ): void {

    this.confirmTitle = title;

    this.confirmMessage =
      message;

    this.confirmAction =
      action;

    this.dialog =
      'confirm';

  }


  confirm(): void {

    this.confirmAction?.();

    this.confirmAction =
      null;

    this.dialog = null;

  }


  cancelDialog(): void {

    this.dialog = null;

    this.confirmAction =
      null;

  }


  // ============================================================
  // LEEKHA AUDIO
  // ============================================================

  private playLeekhaLossAudio(): void {

    try {

      const audio =
        new Audio(
          'assets/audio/leekha-team-lost.mp3',
        );


      audio.volume = 1;


      void audio.play().catch(
        () => {},
      );

    } catch {}

  }


  // ============================================================
  // DATE
  // ============================================================

  formatDate(
    value: string,
  ): string {

    return new Intl.DateTimeFormat(
      'en',
      {
        month: 'short',
        day: 'numeric',
      },
    ).format(
      new Date(value),
    );

  }

  isLastRound(match: Match | null, round: Round | null): boolean {
  if (!match || !round || !match.rounds?.length) {
    return false;
  }
  return match.rounds.length === 7 && round.id === match.rounds[match.rounds.length - 1]?.id;
}
  finishGame(match: Match, round: Round | null): void {
  if (!round) return;
  match.finished = true;
  this.persist();
  this.triggerWinCelebration(round);
}

  activeRoundFor(match: Match | null): Round | null {
  if (!match || !match.rounds?.length) return null;
  return match.rounds[match.rounds.length - 1] || null;
}
// Reads hearts assigned to a specific player
heartsFor(round: Round, playerId: string): number {
  if (!round || !round.hearts) return 0;
  return Number(round.hearts[playerId]) || 0;
}

// Sums all hearts assigned in the round
totalHearts(round: Round): number {
  if (!round || !round.hearts) return 0;
  return Object.values(round.hearts).reduce(
    (sum: number, value: number | undefined) => sum + (Number(value) || 0),
    0
  );
}

// Calculates remaining available hearts out of 13 for a player
maxHeartsForPlayer(round: Round, playerId: string): number {
  const currentTotal = this.totalHearts(round);
  const playerHearts = this.heartsFor(round, playerId);
  const otherTotal = currentTotal - playerHearts;
  return Math.max(0, 13 - otherTotal);
}

stepHearts(round: Round, playerId: string, delta: number): void {
  const current = this.heartsFor(round, playerId);
  const maxAllowed = this.maxHeartsForPlayer(round, playerId);
  const next = Math.max(0, Math.min(maxAllowed, current + delta));
  this.setHearts(round, playerId, next);
}

setHearts(round: Round, playerId: string, value: any): void {
  const parsed = parseInt(value, 10);
  const current = isNaN(parsed) ? 0 : parsed;
  const maxAllowed = this.maxHeartsForPlayer(round, playerId);
  const sanitized = Math.max(0, Math.min(maxAllowed, current));

  if (!round.hearts) {
    round.hearts = {};
  }

  round.hearts[playerId] = sanitized;

  this.persist();
}
// Calculates overall total score for Team 0 or Team 1 in Tarneeb
tarneebTeamScore(match: Match, teamIndex: number): number {
  if (!match || match.game !== 'Tarneb') return 0;

  return match.rounds.reduce((sum, round) => {
    if (round.biddingTeam === undefined || !round.bidAmount || round.bidMade === undefined) {
      return sum;
    }

    if (round.biddingTeam === teamIndex) {
      // Bidding team score: +bid if made, -bid if missed
      return sum + (round.bidMade ? round.bidAmount : -round.bidAmount);
    } else {
      // Non-bidding team score: gets tricks won if bidder missed
      if (round.bidMade === false) {
        return sum + (Number(round.opponentTricks) || 0);
      }
      return sum;
    }
  }, 0);
}

// Event Handlers for Tarneeb inputs
setTarneebBiddingTeam(round: Round, value: any): void {
  round.biddingTeam = Number(value);
  this.persist();
}

setTarneebBidAmount(round: Round, value: any): void {
  round.bidAmount = Number(value);
  this.persist();
}

setTarneebBidResult(match: Match, round: Round, made: boolean): void {
  round.bidMade = made;
  this.checkTarneebWinner(match);
  this.persist();
}

setTarneebOpponentTricks(match: Match, round: Round, value: any): void {
  round.opponentTricks = Math.max(0, Math.min(13, Number(value) || 0));
  this.checkTarneebWinner(match);
  this.persist();
}

// Validates Tarneeb round completion before adding a new round
tarneebRoundComplete(match: Match, round: Round): boolean {
  if (!round || round.biddingTeam === undefined || !round.bidAmount || round.bidMade === undefined) {
    return false;
  }
  if (round.bidMade === false && round.opponentTricks === undefined) {
    return false;
  }
  return true;
}


// Winner check reaching 41 points
checkTarneebWinner(match: Match): void {
  if (match.game !== 'Tarneb' || match.players.length !== 4) return;

  const team1Score = this.tarneebTeamScore(match, 0);
  const team2Score = this.tarneebTeamScore(match, 1);

  if (team1Score >= 41 || team2Score >= 41) {
    match.finished = true;
    const team1Names = `${match.players[0].name} & ${match.players[2].name}`;
    const team2Names = `${match.players[1].name} & ${match.players[3].name}`;
    const winnerNames = team1Score > team2Score ? team1Names : team2Names;

    match.winnerMessage = `${winnerNames} win Tarneeb with ${Math.max(team1Score, team2Score)} points! 🏆`;
    this.showWinVideo = true;
    this.persist();
  }
}

// ============================================================
// CLEAR ALL ROUNDS / RESTART MATCH
// ============================================================

requestClearAllRounds(match: Match): void {
  this.askConfirm(
    'Clear all rounds?',
    `This will permanently erase all ${match.rounds.length} round(s) and reset the scores for this match.`,
    () => {
      match.rounds = [];
      match.finished = false;
      match.winnerMessage = undefined;
      this.selectedRoundIndex = 0;
      this.lastCelebratedRoundId = null;
      this.persist();
    }
  );
}

// Unified start position tracking for touch and mouse drag
// ============================================================
// LEEKHA SWIPE LOGIC
// ============================================================

swipingPlayerId: string | null = null;
swipeOffset = 0;
private swipeStartX = 0;

onSwipeStart(event: MouseEvent | TouchEvent, playerId: string): void {
  this.swipingPlayerId = playerId;
  if (event instanceof MouseEvent) {
    this.swipeStartX = event.clientX;
  } else if (event.touches?.length) {
    this.swipeStartX = event.touches[0].clientX;
  }
}

onSwipeMove(event: MouseEvent | TouchEvent, playerId: string): void {
  if (this.swipingPlayerId !== playerId) return;

  let currentX = 0;
  if (event instanceof MouseEvent) {
    currentX = event.clientX;
  } else if (event.touches?.length) {
    currentX = event.touches[0].clientX;
  }

  const deltaX = this.swipeStartX - currentX;
  this.swipeOffset = deltaX > 0 ? Math.min(80, deltaX) : 0;
}

onSwipeEnd(event: MouseEvent | TouchEvent, round: Round, playerId: string): void {
  if (this.swipingPlayerId !== playerId) return;

  let endX = 0;
  if (event instanceof MouseEvent) {
    endX = event.clientX;
  } else if (event.changedTouches?.length) {
    endX = event.changedTouches[0].clientX;
  }

  const deltaX = this.swipeStartX - endX;

  if (deltaX > 40) {
    this.swipeTakeAll(round, playerId);
  }

  this.swipingPlayerId = null;
  this.swipeOffset = 0;
}

swipeTakeAll(round: Round, playerId: string): void {
  if (!round.hearts) round.hearts = {};

  const alreadyHasAll = 
    this.heartsFor(round, playerId) === 13 &&
    round.queenPlayerId === playerId &&
    round.tenDiamondPlayerId === playerId;

  if (alreadyHasAll) {
    // Reset to 0 if swiped again
    round.hearts[playerId] = 0;
    round.queenPlayerId = undefined;
    round.tenDiamondPlayerId = undefined;
  } else {
    // Give all 36 to swiped player
    if (this.activeMatch?.players) {
      for (const p of this.activeMatch.players) {
        round.hearts[p.id] = 0;
      }
    }
    round.hearts[playerId] = 13;
    round.queenPlayerId = playerId;
    round.tenDiamondPlayerId = playerId;
  }

  this.persist();
}
}
