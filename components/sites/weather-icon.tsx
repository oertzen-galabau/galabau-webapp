import { createElement, type ComponentProps } from 'react';
import { WEATHER_ICON_MAP, type WeatherIconKind } from '@/lib/weather/weather-codes';

type IconProps = ComponentProps<(typeof WEATHER_ICON_MAP)[WeatherIconKind]>;

type Props = {
  kind: WeatherIconKind;
} & IconProps;

export function WeatherIcon({ kind, ...props }: Props) {
  return createElement(WEATHER_ICON_MAP[kind], props);
}
