class Player {
  private position: Position;
  constructor(position: Position) {
    this.position = position;
  }

  updatePosition() {
    this.position.x += 1;
  }
}

export default Player;
