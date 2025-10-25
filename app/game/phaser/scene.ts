import Phaser from 'phaser';

export class BubbleScene extends Phaser.Scene {
  constructor() {
    super('BubbleScene');
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x05070c);
    this.add.text(width / 2, height / 2, 'Bubble Hunt', {
      fontFamily: 'sans-serif',
      fontSize: '32px',
      color: '#f8fafc',
    }).setOrigin(0.5);
  }
}

export default BubbleScene;
