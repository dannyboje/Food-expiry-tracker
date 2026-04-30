import { Stack } from 'expo-router';

export default function RecipesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Recipes', headerLargeTitle: true }} />
    </Stack>
  );
}
