export type RegionCodeLength = 2 | 3;
export type RegionCodeEntryState = { length: RegionCodeLength; value: string; position: number; open: boolean };
type Action = { type: 'select'; length: RegionCodeLength; index: number }
  | { type: 'digit'; digit: string } | { type: 'erase' | 'clear' | 'close' };

export function initialRegionCodeEntry(value: string): RegionCodeEntryState {
  return { length: value.length === 2 ? 2 : 3, value: /^\d{2,3}$/.test(value) ? value : '', position: 0, open: false };
}

export function validRegionCodeEntry(state: RegionCodeEntryState) {
  return state.value.length === state.length && /^\d+$/.test(state.value) && Number(state.value) > 0;
}

export function regionCodeEntryReducer(state: RegionCodeEntryState, action: Action): RegionCodeEntryState {
  switch (action.type) {
    case 'select':
      if (action.index < 0 || action.index >= action.length) return state;
      return { length: action.length, position: action.index, open: true,
        value: action.length !== state.length || (!state.open && action.index === 0) ? '' : state.value };
    case 'digit': {
      if (!state.open || !/^\d$/.test(action.digit)) return state;
      const characters = state.value.padEnd(state.length, ' ').split('');
      characters[state.position] = action.digit;
      return { ...state, value: characters.join('').trimEnd(), position: Math.min(state.length - 1, state.position + 1) };
    }
    case 'erase': {
      const position = state.value[state.position]?.trim() ? state.position : Math.max(0, state.position - 1);
      const characters = state.value.padEnd(state.length, ' ').split('');
      characters[position] = ' ';
      return { ...state, value: characters.join('').trimEnd(), position };
    }
    case 'clear': return { ...state, value: '', position: 0 };
    case 'close': return { ...state, open: false };
  }
}
