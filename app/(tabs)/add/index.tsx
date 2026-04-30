import { View } from 'react-native';

// The + button in _layout.tsx uses tabBarButton: () => <AddTabButton /> which calls
// router.push('/add-item') directly. This screen is only reached if somehow the add
// tab becomes focused without the modal being opened, so render nothing.
export default function AddTab() {
  return <View />;
}
