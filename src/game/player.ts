class Player {
  private position: TPosition;
  constructor(position: TPosition) {
    this.position = position;
  }

  updatePosition() {
    this.position.row += 1;
  }
}

export default Player;
