import { LabelDriver } from '../types';
import { TPCLDriver } from './tpcl';
import { ZPLDriver } from './zpl';

export const drivers: Record<string, LabelDriver> = {
  'tpcl': new TPCLDriver(),
  'zpl': new ZPLDriver()
};

export function getDriverForFile(filename: string): LabelDriver | undefined {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return Object.values(drivers).find(d => d.supportedExtensions.includes(ext));
}

export function getDriverByName(name: string): LabelDriver | undefined {
  return drivers[name.toLowerCase()];
}
