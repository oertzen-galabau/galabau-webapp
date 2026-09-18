-- Erweitert leave_type um "sonstige" für Fehlzeiten mit freiem Grund
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'sonstige';
