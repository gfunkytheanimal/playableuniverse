export class Clock {
  constructor() {
    this.now = 0;
    this.songTime = 0;
    this.songRunning = false;
    this.songDuration = 0;
  }

  startSong(duration = 0) {
    this.songTime = 0;
    this.songRunning = true;
    this.songDuration = duration;
  }

  stopSong() {
    this.songRunning = false;
  }

  advance(dt, songPlaying) {
    this.now += dt;
    if (songPlaying) this.songRunning = true;
    if (this.songRunning && songPlaying) this.songTime += dt;
  }
}
