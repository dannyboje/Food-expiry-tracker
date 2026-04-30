import { StyleSheet, Text, View } from 'react-native';

type Item = {
  emoji: string;
  size: number;
  deg: string;
  top?: number;
  bottom?: number;
  left?: number | string;
  right?: number | string;
};

const HEADER: Item[] = [
  { emoji: '🥦', top: 10,    left: 45,    size: 36, deg: '-15deg' },
  { emoji: '🍎', top: 8,     left: 135,   size: 28, deg: '10deg'  },
  { emoji: '🥛', top: 18,    right: 105,  size: 28, deg: '-20deg' },
  { emoji: '🥕', top: 50,    left: 80,    size: 24, deg: '20deg'  },
  { emoji: '💊', top: 52,    right: 68,   size: 24, deg: '5deg'   },
  { emoji: '🥩', bottom: 16, left: 42,    size: 26, deg: '-10deg' },
  { emoji: '🍋', bottom: 20, right: 135,  size: 26, deg: '15deg'  },
  { emoji: '🫐', top: 28,    left: 205,   size: 24, deg: '-5deg'  },
  { emoji: '🍊', top: 12,    right: 45,   size: 26, deg: '12deg'  },
  { emoji: '🧄', bottom: 14, left: '48%', size: 22, deg: '-8deg'  },
];

const BG: Item[] = [
  { emoji: '🥦', top: 195, left: 12,    size: 56, deg: '-22deg' },
  { emoji: '🍎', top: 270, right: 8,    size: 58, deg: '16deg'  },
  { emoji: '🍋', top: 230, left: '42%', size: 44, deg: '18deg'  },
  { emoji: '🥛', top: 355, left: 18,    size: 52, deg: '-6deg'  },
  { emoji: '🧄', top: 320, left: '42%', size: 46, deg: '10deg'  },
  { emoji: '🥕', top: 445, right: 12,   size: 54, deg: '26deg'  },
  { emoji: '🥑', top: 490, left: '44%', size: 50, deg: '-8deg'  },
  { emoji: '🥩', top: 530, left: 14,    size: 58, deg: '-16deg' },
  { emoji: '💊', top: 610, right: 16,   size: 50, deg: '8deg'   },
  { emoji: '🍊', top: 670, left: 16,    size: 54, deg: '14deg'  },
  { emoji: '🍇', top: 660, left: '40%', size: 46, deg: '-12deg' },
  { emoji: '🫐', top: 745, right: 14,   size: 56, deg: '-10deg' },
];

function renderItem(item: Item, i: number, baseStyle: object) {
  return (
    <Text
      key={i}
      style={[
        baseStyle,
        {
          fontSize: item.size,
          top: item.top,
          bottom: item.bottom,
          left: item.left,
          right: item.right,
          transform: [{ rotate: item.deg }],
        },
      ]}>
      {item.emoji}
    </Text>
  );
}

export function HeaderFoodDecor() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {HEADER.map((item, i) => renderItem(item, i, styles.h))}
    </View>
  );
}

export function BgFoodDecor() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {BG.map((item, i) => renderItem(item, i, styles.bg))}
    </View>
  );
}

const styles = StyleSheet.create({
  h:  { position: 'absolute', opacity: 0.18 },
  bg: { position: 'absolute', opacity: 0.07 },
});
