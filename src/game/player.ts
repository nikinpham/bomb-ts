class Player {
  private position: TPosition;
  constructor(position: TPosition) {
    this.position = position;
  }

  updatePosition() {
    this.position.x += 1;
  }
}

export default Player;
