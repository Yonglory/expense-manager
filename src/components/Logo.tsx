import { Image } from 'react-native';

export function Logo({ size = "100%" }: { size?: number | string }) {
  return (
    <Image source={require('../assets/logo.png')} style={{ width: size, height: size }} />
  );
}
