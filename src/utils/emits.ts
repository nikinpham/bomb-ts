import { socket } from '../server';
import { EMIT_ACTIONS, EMITS, MOVE_DIRECTION } from '../constants';

export const drive = (direction: string | null, characterType?: string) => {
  direction &&
    socket.emit(EMITS.DRIVE, {
      direction,
      ...(characterType && { characterType })
    });
};

export const emitUseSpecialSkill = (distance: number = 10, characterType?: string) => {
  socket.emit(EMITS.ACTIONS, {
    action: EMIT_ACTIONS.USE_WEAPON,
    characterType: {
      distance
    },
    ...(characterType && { characterType })
  });
  drive(MOVE_DIRECTION.STOP);
};

export const emitSwitchWeapon = (characterType?: string) => {
  socket.emit(EMITS.ACTIONS, {
    action: EMIT_ACTIONS.SWITCH_WEAPON,
    ...(characterType && { characterType })
  });
};

export const emitWedding = () => {
  socket.emit(EMITS.ACTIONS, {
    action: EMIT_ACTIONS.MARRY_WIFE
  });
};

export const emitTrashTalk = () => {
  socket.emit(EMITS.SPEAK, { command: 't4' });
};
