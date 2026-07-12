// ---------------------------------------------------------------------------
// DTC knowledge base — generic OBD-II codes most seen in the Indian car parc
// (Maruti, Hyundai, Tata, Mahindra, Honda, Toyota, Kia + common-rail diesels
// and BS6 DPF cars). Static in-code data, same choice as the festival dataset
// in calendar/holidays.ts: no seed step, versioned with the code.
//
// Cost bands are INDICATIVE Indian independent-workshop estimates (parts +
// labour, non-OEM where sane), stored in paise like all money. The UI must
// present them as estimates, never quotes.
// ---------------------------------------------------------------------------

export type DtcSystem =
  | "engine"
  | "transmission"
  | "abs_brakes"
  | "airbag"
  | "network"
  | "electrical"
  | "emissions"
  | "cooling"
  | "fuel"
  | "body"
  | "unknown";

export type DtcSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface DtcInfo {
  description: string;
  system: DtcSystem;
  severity: DtcSeverity;
  causes: string[];
  fix: string; // typical repair action
  costMin: number; // paise
  costMax: number; // paise
  laborHours: number;
}

// helper — costs written in rupees for readability, stored as paise
function d(
  description: string,
  system: DtcSystem,
  severity: DtcSeverity,
  causes: string[],
  fix: string,
  costMinRs: number,
  costMaxRs: number,
  laborHours: number
): DtcInfo {
  return { description, system, severity, causes, fix, costMin: costMinRs * 100, costMax: costMaxRs * 100, laborHours };
}

export const DTC_DATABASE: Record<string, DtcInfo> = {
  // --- Air / fuel metering -------------------------------------------------
  P0100: d("Mass Air Flow (MAF) Circuit Malfunction", "engine", "high", ["Dirty/failed MAF sensor", "Wiring or connector fault", "Air leak after MAF"], "Clean MAF sensor; replace if readings stay implausible", 500, 9000, 1),
  P0101: d("MAF Circuit Range/Performance", "engine", "medium", ["Contaminated MAF element", "Intake leak", "Clogged air filter"], "Replace air filter, clean MAF, smoke-test intake", 400, 8000, 1),
  P0102: d("MAF Circuit Low Input", "engine", "medium", ["MAF wiring short to ground", "Failed sensor"], "Inspect harness, replace MAF sensor", 500, 9000, 1),
  P0103: d("MAF Circuit High Input", "engine", "medium", ["MAF wiring short to voltage", "Failed sensor"], "Inspect harness, replace MAF sensor", 500, 9000, 1),
  P0105: d("MAP Circuit Malfunction", "engine", "medium", ["MAP sensor failure", "Blocked/cracked vacuum hose"], "Replace MAP sensor or vacuum hose", 600, 5000, 0.8),
  P0106: d("MAP Range/Performance Problem", "engine", "medium", ["Vacuum leak", "MAP sensor drift"], "Smoke-test intake, replace MAP sensor", 600, 5000, 1),
  P0110: d("Intake Air Temperature Circuit Malfunction", "engine", "low", ["IAT sensor failure", "Connector corrosion"], "Replace IAT sensor / repair connector", 400, 2500, 0.5),
  P0113: d("Intake Air Temperature Circuit High", "engine", "low", ["Open IAT circuit", "Failed sensor"], "Repair wiring, replace IAT sensor", 400, 2500, 0.5),
  P0120: d("Throttle Position Sensor Circuit Malfunction", "engine", "high", ["TPS failure", "Throttle body carbon build-up", "Wiring fault"], "Clean throttle body, replace TPS/throttle body if erratic", 800, 15000, 1.5),
  P0121: d("TPS Range/Performance Problem", "engine", "medium", ["TPS drift", "Carbon on throttle plate"], "Throttle body cleaning + relearn", 600, 8000, 1),
  P0122: d("TPS Circuit Low Input", "engine", "high", ["TPS short to ground", "Broken wiring"], "Repair wiring, replace TPS", 800, 12000, 1),
  P0123: d("TPS Circuit High Input", "engine", "high", ["TPS short to voltage"], "Repair wiring, replace TPS", 800, 12000, 1),
  P0171: d("System Too Lean (Bank 1)", "engine", "high", ["Intake/vacuum leak", "Weak fuel pump or clogged filter", "Dirty MAF", "Stuck-open PCV"], "Smoke-test intake for leaks, check fuel pressure, clean MAF", 500, 12000, 1.5),
  P0172: d("System Too Rich (Bank 1)", "engine", "medium", ["Leaking injector", "Faulty O2 sensor", "High fuel pressure", "Dirty MAF"], "Injector service, verify fuel pressure and O2 response", 1000, 12000, 1.5),
  P0174: d("System Too Lean (Bank 2)", "engine", "high", ["Intake/vacuum leak", "Fuel delivery restriction"], "Smoke-test intake, check fuel delivery", 500, 12000, 1.5),
  P0175: d("System Too Rich (Bank 2)", "engine", "medium", ["Leaking injector", "Faulty O2 sensor"], "Injector service, verify O2 response", 1000, 12000, 1.5),

  // --- Injectors / fuel delivery (petrol + common-rail diesel) -------------
  P0087: d("Fuel Rail Pressure Too Low", "fuel", "critical", ["Clogged diesel filter", "Weak low-pressure pump", "Worn high-pressure pump", "Leaking injector back-flow"], "Replace fuel filter first, then test HP pump and injector back-leak", 900, 45000, 3),
  P0088: d("Fuel Rail Pressure Too High", "fuel", "high", ["Stuck rail pressure regulator", "Faulty rail pressure sensor"], "Replace pressure regulator/SCV valve", 3000, 18000, 2),
  P0089: d("Fuel Pressure Regulator Performance", "fuel", "high", ["Suction control valve wear", "Contaminated fuel"], "Replace SCV/regulator, flush fuel system", 3000, 15000, 2),
  P0091: d("Fuel Pressure Regulator Control Circuit Low", "fuel", "high", ["Regulator solenoid short", "Wiring fault"], "Repair wiring, replace regulator solenoid", 2500, 15000, 2),
  P0093: d("Fuel System Leak Detected (Large)", "fuel", "critical", ["Fuel line leak", "Injector seal failure"], "Pressure-test and repair fuel lines/seals immediately", 1500, 20000, 2.5),
  P0190: d("Fuel Rail Pressure Sensor Circuit", "fuel", "high", ["Rail pressure sensor failure", "Wiring fault"], "Replace rail pressure sensor", 2500, 12000, 1.5),
  P0191: d("Fuel Rail Pressure Sensor Range/Performance", "fuel", "high", ["Sensor drift", "Actual pressure fault"], "Compare commanded vs actual rail pressure, replace sensor", 2500, 12000, 1.5),
  P0201: d("Injector Circuit Malfunction — Cylinder 1", "fuel", "high", ["Injector coil open", "Harness fault"], "Test injector resistance, replace injector", 2000, 25000, 2),
  P0202: d("Injector Circuit Malfunction — Cylinder 2", "fuel", "high", ["Injector coil open", "Harness fault"], "Test injector resistance, replace injector", 2000, 25000, 2),
  P0203: d("Injector Circuit Malfunction — Cylinder 3", "fuel", "high", ["Injector coil open", "Harness fault"], "Test injector resistance, replace injector", 2000, 25000, 2),
  P0204: d("Injector Circuit Malfunction — Cylinder 4", "fuel", "high", ["Injector coil open", "Harness fault"], "Test injector resistance, replace injector", 2000, 25000, 2),
  P0230: d("Fuel Pump Primary Circuit Malfunction", "fuel", "high", ["Fuel pump relay", "Pump wiring", "Failing pump"], "Test relay and pump current draw, replace as needed", 800, 12000, 1.5),

  // --- Misfires --------------------------------------------------------------
  P0300: d("Random/Multiple Cylinder Misfire Detected", "engine", "critical", ["Worn spark plugs/coils", "Vacuum leak", "Low fuel pressure", "Low compression"], "Inspect plugs & coils all cylinders, compression test if persistent", 1200, 20000, 2),
  P0301: d("Cylinder 1 Misfire Detected", "engine", "high", ["Spark plug", "Ignition coil", "Injector", "Compression loss"], "Swap coil/plug to isolate, replace faulty part", 800, 10000, 1),
  P0302: d("Cylinder 2 Misfire Detected", "engine", "high", ["Spark plug", "Ignition coil", "Injector", "Compression loss"], "Swap coil/plug to isolate, replace faulty part", 800, 10000, 1),
  P0303: d("Cylinder 3 Misfire Detected", "engine", "high", ["Spark plug", "Ignition coil", "Injector", "Compression loss"], "Swap coil/plug to isolate, replace faulty part", 800, 10000, 1),
  P0304: d("Cylinder 4 Misfire Detected", "engine", "high", ["Spark plug", "Ignition coil", "Injector", "Compression loss"], "Swap coil/plug to isolate, replace faulty part", 800, 10000, 1),

  // --- Ignition / knock / timing --------------------------------------------
  P0325: d("Knock Sensor 1 Circuit Malfunction", "engine", "medium", ["Knock sensor failure", "Wiring fault"], "Replace knock sensor", 1500, 7000, 1.5),
  P0335: d("Crankshaft Position Sensor Circuit Malfunction", "engine", "critical", ["CKP sensor failure", "Damaged reluctor ring", "Wiring"], "Replace crankshaft position sensor", 1200, 6500, 1),
  P0336: d("Crankshaft Position Sensor Range/Performance", "engine", "high", ["Sensor air-gap/debris", "Reluctor damage"], "Clean/replace CKP sensor, inspect reluctor", 1200, 6500, 1),
  P0340: d("Camshaft Position Sensor Circuit Malfunction", "engine", "high", ["CMP sensor failure", "Wiring", "Timing misalignment"], "Replace camshaft position sensor", 1200, 6000, 1),
  P0341: d("Camshaft Position Sensor Range/Performance", "engine", "high", ["Timing chain stretch", "CMP sensor drift"], "Verify timing marks, replace CMP sensor", 1200, 15000, 2),
  P0011: d("Camshaft Position Timing Over-Advanced (Bank 1)", "engine", "high", ["Dirty/low engine oil", "Sticking VVT solenoid", "Timing chain stretch"], "Oil + filter change first, then VVT solenoid, then chain inspection", 800, 25000, 2),
  P0012: d("Camshaft Position Timing Over-Retarded (Bank 1)", "engine", "high", ["Dirty/low engine oil", "Sticking VVT solenoid", "Timing chain stretch"], "Oil + filter change first, then VVT solenoid, then chain inspection", 800, 25000, 2),
  P0014: d("Exhaust Camshaft Timing Over-Advanced (Bank 1)", "engine", "high", ["Oil condition", "VVT solenoid", "Chain stretch"], "Oil service, VVT solenoid replacement", 800, 25000, 2),
  P0016: d("Crank/Cam Position Correlation (Bank 1 Sensor A)", "engine", "critical", ["Jumped timing chain/belt", "Failed tensioner", "Sensor fault"], "Inspect timing chain/belt alignment urgently — do not drive far", 3000, 35000, 4),
  P0017: d("Crank/Cam Position Correlation (Bank 1 Sensor B)", "engine", "critical", ["Jumped timing", "Tensioner failure"], "Inspect timing alignment urgently", 3000, 35000, 4),

  // --- O2 sensors / catalyst / emissions -------------------------------------
  P0130: d("O2 Sensor Circuit Malfunction (Bank 1 Sensor 1)", "emissions", "medium", ["Aged O2 sensor", "Wiring/heater fault", "Exhaust leak"], "Replace upstream O2 sensor", 2500, 9000, 1),
  P0133: d("O2 Sensor Slow Response (Bank 1 Sensor 1)", "emissions", "medium", ["Aged O2 sensor", "Exhaust leak", "Contamination"], "Replace upstream O2 sensor, check for exhaust leaks", 2500, 9000, 1),
  P0135: d("O2 Sensor Heater Circuit (Bank 1 Sensor 1)", "emissions", "medium", ["Heater element open", "Blown fuse", "Wiring"], "Check fuse/wiring, replace O2 sensor", 2500, 9000, 1),
  P0136: d("O2 Sensor Circuit (Bank 1 Sensor 2)", "emissions", "low", ["Aged downstream sensor", "Wiring"], "Replace downstream O2 sensor", 2200, 8000, 1),
  P0138: d("O2 Sensor Circuit High Voltage (Bank 1 Sensor 2)", "emissions", "low", ["Sensor short", "Rich running"], "Replace downstream O2 sensor", 2200, 8000, 1),
  P0141: d("O2 Sensor Heater Circuit (Bank 1 Sensor 2)", "emissions", "low", ["Heater element open", "Wiring"], "Replace downstream O2 sensor", 2200, 8000, 1),
  P0420: d("Catalyst System Efficiency Below Threshold (Bank 1)", "emissions", "high", ["Aged/poisoned catalytic converter", "Persistent misfire upstream", "O2 sensor drift", "Exhaust leak"], "Fix any misfire/lean cause FIRST, verify O2 sensors, then catalyst replacement", 3000, 60000, 2.5),
  P0430: d("Catalyst System Efficiency Below Threshold (Bank 2)", "emissions", "high", ["Aged catalytic converter", "Upstream running fault"], "Fix running faults first, then catalyst replacement", 3000, 60000, 2.5),
  P0400: d("EGR Flow Malfunction", "emissions", "medium", ["Carbon-clogged EGR valve", "Failed EGR solenoid", "Blocked passages"], "Remove and clean EGR valve + passages", 1000, 12000, 2),
  P0401: d("EGR Insufficient Flow Detected", "emissions", "medium", ["Clogged EGR passages", "Stuck EGR valve"], "EGR cleaning/decarbonising", 1000, 12000, 2),
  P0402: d("EGR Excessive Flow Detected", "emissions", "medium", ["EGR valve stuck open"], "Clean/replace EGR valve", 1500, 14000, 2),
  P0403: d("EGR Circuit Malfunction", "emissions", "medium", ["EGR solenoid electrical fault", "Wiring"], "Replace EGR solenoid/valve", 1500, 14000, 1.5),
  P0440: d("EVAP System Malfunction", "emissions", "low", ["Loose/failed fuel cap", "EVAP hose leak", "Purge valve"], "Check fuel cap first (cheapest fix), then smoke-test EVAP", 100, 6000, 1),
  P0441: d("EVAP Incorrect Purge Flow", "emissions", "low", ["Purge valve stuck", "Blocked purge line"], "Replace purge valve", 800, 5000, 1),
  P0442: d("EVAP Small Leak Detected", "emissions", "low", ["Fuel cap seal", "Cracked EVAP hose"], "Replace fuel cap, smoke-test if code returns", 100, 5000, 1),
  P0446: d("EVAP Vent Control Circuit Malfunction", "emissions", "low", ["Vent valve failure", "Blocked vent"], "Replace vent valve", 800, 5000, 1),
  P0455: d("EVAP Large Leak Detected", "emissions", "low", ["Missing/loose fuel cap", "Disconnected EVAP hose"], "Refit fuel cap, inspect EVAP hoses", 100, 5000, 1),
  P0456: d("EVAP Very Small Leak Detected", "emissions", "low", ["Fuel cap seal ageing", "Pinhole in hose"], "Replace fuel cap, smoke-test EVAP", 100, 5000, 1),

  // --- DPF / diesel after-treatment (BS6) ------------------------------------
  P2002: d("Diesel Particulate Filter Efficiency Below Threshold", "emissions", "high", ["Soot-loaded DPF from short city trips", "Failed regeneration", "Pressure sensor fault"], "Forced regeneration; DPF chemical clean if regen fails — avoid removal (illegal)", 2500, 40000, 2),
  P2452: d("DPF Pressure Sensor Circuit", "emissions", "medium", ["Differential pressure sensor failure", "Blocked/cracked sensor hoses"], "Replace DPF pressure sensor/hoses", 2000, 10000, 1),
  P2453: d("DPF Pressure Sensor Range/Performance", "emissions", "medium", ["Sensor hose blockage", "Sensor drift"], "Clean/replace sensor hoses and sensor", 2000, 10000, 1),
  P2463: d("DPF Soot Accumulation Restriction", "emissions", "high", ["Excessive soot load", "Repeated interrupted regens"], "Highway forced regen, then DPF cleaning service", 2500, 40000, 2),
  P0380: d("Glow Plug/Heater Circuit A Malfunction", "engine", "medium", ["Failed glow plug(s)", "Glow relay/module", "Wiring"], "Test each glow plug resistance, replace failed plugs/relay", 1500, 8000, 1.5),

  // --- Turbo / boost ----------------------------------------------------------
  P0234: d("Turbocharger Overboost Condition", "engine", "high", ["Stuck wastegate/VGT vanes", "Boost sensor fault"], "Free VGT actuator/vanes, verify boost control", 2500, 30000, 3),
  P0235: d("Turbocharger Boost Sensor Circuit", "engine", "medium", ["Boost pressure sensor failure", "Wiring"], "Replace boost pressure sensor", 1500, 7000, 1),
  P0299: d("Turbocharger Underboost Condition", "engine", "high", ["Leaking intercooler hose/pipe", "Sticking VGT actuator", "Worn turbo", "Clogged air filter"], "Pressure-test boost pipes first, then actuator, then turbo inspection", 800, 60000, 3),

  // --- Idle / speed / cooling -------------------------------------------------
  P0500: d("Vehicle Speed Sensor Malfunction", "engine", "medium", ["VSS failure", "Instrument cluster fault", "Wiring"], "Replace vehicle speed sensor", 900, 5000, 1),
  P0505: d("Idle Control System Malfunction", "engine", "medium", ["Dirty IAC valve/throttle body", "Vacuum leak"], "Clean IAC valve and throttle body", 500, 6000, 1),
  P0507: d("Idle Air Control RPM Higher Than Expected", "engine", "medium", ["Vacuum leak", "Throttle body carbon"], "Smoke-test intake, throttle body service", 500, 6000, 1),
  P0115: d("Engine Coolant Temperature Circuit Malfunction", "cooling", "medium", ["ECT sensor failure", "Wiring/connector"], "Replace ECT sensor", 500, 3000, 0.7),
  P0116: d("Engine Coolant Temperature Range/Performance", "cooling", "medium", ["Stuck thermostat", "ECT sensor drift"], "Replace thermostat and/or ECT sensor", 800, 6000, 1.5),
  P0117: d("Engine Coolant Temperature Circuit Low", "cooling", "medium", ["ECT short to ground"], "Repair wiring, replace ECT sensor", 500, 3000, 0.7),
  P0118: d("Engine Coolant Temperature Circuit High", "cooling", "medium", ["ECT open circuit"], "Repair wiring, replace ECT sensor", 500, 3000, 0.7),
  P0125: d("Insufficient Coolant Temp for Closed Loop", "cooling", "medium", ["Stuck-open thermostat", "Low coolant"], "Replace thermostat, top up coolant", 800, 5000, 1.5),
  P0128: d("Coolant Temp Below Thermostat Regulating Temperature", "cooling", "medium", ["Stuck-open thermostat", "ECT drift"], "Replace thermostat", 800, 5000, 1.5),
  P0217: d("Engine Overheat Condition", "cooling", "critical", ["Low coolant/leak", "Failed radiator fan", "Failed water pump", "Clogged radiator"], "STOP driving — pressure-test cooling system, check fan and pump", 500, 25000, 2.5),

  // --- Battery / charging / ECU ------------------------------------------------
  P0562: d("System Voltage Low", "electrical", "high", ["Weak/aged battery", "Failing alternator", "Corroded ground straps"], "Load-test battery and alternator output, clean grounds", 500, 15000, 1),
  P0563: d("System Voltage High", "electrical", "high", ["Faulty voltage regulator/alternator"], "Replace alternator/regulator", 3000, 18000, 1.5),
  P0620: d("Generator Control Circuit Malfunction", "electrical", "medium", ["Alternator control wiring", "Alternator internal fault"], "Test alternator control circuit, replace alternator", 3000, 18000, 1.5),
  P0601: d("Internal Control Module Memory Checksum Error", "electrical", "high", ["ECM internal fault", "Voltage spikes"], "Verify charging system, then ECM reflash/replacement", 1000, 40000, 2),
  P0603: d("Internal Control Module Keep-Alive Memory Error", "electrical", "medium", ["Battery disconnect history", "Weak battery", "ECM fault"], "Check battery health first; ECM only if code persists", 500, 40000, 1),
  P0606: d("ECM/PCM Processor Fault", "electrical", "high", ["ECM internal failure"], "ECM diagnosis/reflash/replacement at specialist", 2000, 45000, 3),

  // --- Throttle-by-wire ---------------------------------------------------------
  P2101: d("Throttle Actuator Control Motor Circuit Range/Performance", "engine", "high", ["Throttle body motor wear", "Carbon jam", "Wiring"], "Clean throttle body, replace if motor worn", 1000, 18000, 1.5),
  P2110: d("Throttle Actuator Control — Forced Limited RPM", "engine", "high", ["Throttle body fault (limp mode)"], "Throttle body service/replacement + relearn", 1000, 18000, 1.5),
  P2135: d("Throttle/Pedal Position Sensor Voltage Correlation", "engine", "high", ["TPS/APP sensor mismatch", "Connector corrosion"], "Replace throttle body or pedal sensor after testing both", 1500, 18000, 1.5),

  // --- Transmission -------------------------------------------------------------
  P0700: d("Transmission Control System Malfunction (TCM request)", "transmission", "high", ["TCM has stored codes — read transmission ECU"], "Scan TCM for specific codes; this is only the indicator", 0, 0, 0.5),
  P0705: d("Transmission Range Sensor Circuit Malfunction", "transmission", "high", ["Range/inhibitor switch failure", "Linkage misadjustment"], "Adjust/replace inhibitor switch", 1500, 9000, 1.5),
  P0715: d("Input/Turbine Speed Sensor Circuit", "transmission", "high", ["Input speed sensor failure", "Wiring"], "Replace input speed sensor", 1500, 8000, 1.5),
  P0720: d("Output Speed Sensor Circuit", "transmission", "high", ["Output speed sensor failure", "Wiring"], "Replace output speed sensor", 1500, 8000, 1.5),
  P0730: d("Incorrect Gear Ratio", "transmission", "critical", ["Low/burnt ATF", "Worn clutches", "Valve body wear"], "ATF level & condition check first, then internal inspection", 1500, 80000, 4),
  P0740: d("Torque Converter Clutch Circuit Malfunction", "transmission", "high", ["TCC solenoid failure", "ATF condition"], "ATF service, replace TCC solenoid", 2000, 25000, 3),
  P0741: d("Torque Converter Clutch Stuck Off", "transmission", "high", ["TCC solenoid", "Converter wear"], "ATF service, TCC solenoid, converter if persistent", 2000, 45000, 4),
  P0750: d("Shift Solenoid A Malfunction", "transmission", "high", ["Shift solenoid failure", "Dirty ATF"], "ATF flush + shift solenoid replacement", 2000, 20000, 3),

  // --- Hybrid / EV ---------------------------------------------------------------
  P0A80: d("Replace Hybrid Battery Pack", "electrical", "critical", ["Degraded hybrid battery modules"], "Hybrid battery diagnosis; module or pack replacement at specialist", 25000, 250000, 6),
  P0AA6: d("Hybrid Battery Voltage System Isolation Fault", "electrical", "critical", ["HV insulation breakdown", "Coolant intrusion"], "HV isolation test at authorised EV workshop — safety critical", 3000, 80000, 4),

  // --- ABS / chassis (C) -----------------------------------------------------------
  C0035: d("Left Front Wheel Speed Sensor Circuit", "abs_brakes", "high", ["WSS failure", "Damaged tone ring", "Metal debris on sensor", "Wiring chafe"], "Clean/replace wheel speed sensor, inspect tone ring", 1200, 6000, 1),
  C0040: d("Right Front Wheel Speed Sensor Circuit", "abs_brakes", "high", ["WSS failure", "Tone ring damage", "Wiring"], "Clean/replace wheel speed sensor, inspect tone ring", 1200, 6000, 1),
  C0045: d("Left Rear Wheel Speed Sensor Circuit", "abs_brakes", "high", ["WSS failure", "Tone ring damage", "Wiring"], "Clean/replace wheel speed sensor, inspect tone ring", 1200, 6000, 1),
  C0050: d("Right Rear Wheel Speed Sensor Circuit", "abs_brakes", "high", ["WSS failure", "Tone ring damage", "Wiring"], "Clean/replace wheel speed sensor, inspect tone ring", 1200, 6000, 1),
  C0110: d("ABS Pump Motor Circuit Malfunction", "abs_brakes", "critical", ["ABS pump motor failure", "Relay/wiring"], "Test pump motor circuit; ABS unit repair/replacement", 3000, 45000, 3),
  C0121: d("ABS Valve Relay Circuit Malfunction", "abs_brakes", "high", ["ABS module relay failure", "Wiring"], "ABS module diagnosis/repair", 2000, 35000, 2),
  C0561: d("ABS Disabled — System Malfunction", "abs_brakes", "high", ["Companion codes present", "Module fault"], "Read all chassis codes; fix companion faults first", 500, 10000, 1),

  // --- Airbag / restraint (B) -----------------------------------------------------
  B0001: d("Driver Frontal Deployment Loop Circuit", "airbag", "critical", ["Clock spring failure", "Airbag squib circuit", "Connector under seat"], "Inspect clock spring and squib connectors — airbag may not deploy", 2500, 15000, 2),
  B0010: d("Passenger Frontal Deployment Loop Circuit", "airbag", "critical", ["Squib circuit fault", "Connector fault"], "Inspect passenger airbag circuit", 2500, 15000, 2),
  B0050: d("Seat Belt Pretensioner Deployment Loop", "airbag", "high", ["Pretensioner squib circuit", "Under-seat connector disturbed"], "Reseat under-seat connectors, replace pretensioner if open", 1500, 12000, 1.5),
  B0081: d("Occupant Classification Sensor Fault", "airbag", "medium", ["Seat occupancy sensor/mat failure"], "Replace occupancy sensor/mat", 2000, 12000, 1.5),

  // --- Network (U) -------------------------------------------------------------------
  U0001: d("High-Speed CAN Communication Bus Fault", "network", "high", ["CAN wiring short/open", "Failing module pulling bus down", "Corroded connector"], "CAN bus resistance test (~60Ω), isolate module by unplugging", 1000, 15000, 2),
  U0100: d("Lost Communication With ECM/PCM", "network", "high", ["ECM power/ground loss", "CAN wiring", "ECM failure"], "Check ECM fuses/grounds, CAN continuity", 500, 20000, 2),
  U0101: d("Lost Communication With TCM", "network", "high", ["TCM power loss", "CAN wiring"], "Check TCM fuses/grounds, CAN continuity", 500, 20000, 2),
  U0121: d("Lost Communication With ABS Module", "network", "high", ["ABS module power", "CAN wiring"], "Check ABS fuses, CAN continuity to ABS module", 500, 20000, 2),
  U0140: d("Lost Communication With Body Control Module", "network", "medium", ["BCM power/ground", "CAN wiring"], "Check BCM fuses/grounds", 500, 15000, 1.5),
  U0155: d("Lost Communication With Instrument Cluster", "network", "medium", ["Cluster power", "CAN wiring"], "Check cluster connector and CAN lines", 500, 15000, 1.5),
};

// Cylinder-misfire codes beyond the seeded ones (P0305–P0312) and other
// pattern families resolve through here when not an exact KB hit.
const FAMILY_FALLBACKS: { pattern: RegExp; info: () => DtcInfo }[] = [
  {
    pattern: /^P03(0[5-9]|1[0-2])$/,
    info: () => d("Cylinder Misfire Detected", "engine", "high", ["Spark plug", "Ignition coil", "Injector", "Compression loss"], "Isolate cylinder by swapping coil/plug, replace faulty part", 800, 10000, 1),
  },
  { pattern: /^P00/, info: () => d("Fuel & Air Metering / Auxiliary Emission Fault", "engine", "medium", ["Sensor or metering fault — see code description on report"], "Diagnose per scanner description", 500, 10000, 1) },
  { pattern: /^P01/, info: () => d("Fuel & Air Metering Fault", "engine", "medium", ["Fuel/air metering component fault"], "Diagnose fuel and air metering circuit", 500, 12000, 1) },
  { pattern: /^P02/, info: () => d("Injector Circuit Fault", "fuel", "high", ["Injector or injector circuit fault"], "Test injector circuits", 1500, 20000, 1.5) },
  { pattern: /^P03/, info: () => d("Ignition System or Misfire Fault", "engine", "high", ["Ignition system fault"], "Inspect ignition components", 800, 12000, 1) },
  { pattern: /^P04/, info: () => d("Auxiliary Emission Control Fault", "emissions", "medium", ["Emission control component fault"], "Diagnose emission control system", 500, 15000, 1) },
  { pattern: /^P05/, info: () => d("Vehicle Speed / Idle Control Fault", "engine", "medium", ["Speed or idle control fault"], "Diagnose idle/speed control", 500, 8000, 1) },
  { pattern: /^P06/, info: () => d("Computer Output Circuit Fault", "electrical", "high", ["ECM/output circuit fault"], "ECM circuit diagnosis", 1000, 30000, 2) },
  { pattern: /^P0[789]/, info: () => d("Transmission Fault", "transmission", "high", ["Transmission component fault"], "Transmission ECU diagnosis", 1500, 40000, 2) },
  { pattern: /^P0A/, info: () => d("Hybrid Propulsion Fault", "electrical", "critical", ["Hybrid system fault"], "Hybrid specialist diagnosis", 3000, 100000, 3) },
  { pattern: /^P1/, info: () => d("Manufacturer-Specific Powertrain Fault", "engine", "medium", ["Refer to OEM code chart for this make"], "Diagnose per manufacturer service data", 500, 15000, 1.5) },
  { pattern: /^P2/, info: () => d("Powertrain Fault (ISO/SAE Reserved)", "engine", "medium", ["Powertrain component fault"], "Diagnose per scanner description", 500, 15000, 1.5) },
  { pattern: /^P3/, info: () => d("Powertrain Fault (Manufacturer/Reserved)", "engine", "medium", ["Powertrain component fault"], "Diagnose per manufacturer data", 500, 15000, 1.5) },
  { pattern: /^C0/, info: () => d("Chassis Fault (ABS/Suspension/Steering)", "abs_brakes", "high", ["Chassis system fault"], "Chassis system diagnosis", 1000, 20000, 1.5) },
  { pattern: /^C[1-3]/, info: () => d("Manufacturer-Specific Chassis Fault", "abs_brakes", "high", ["Refer to OEM chassis code chart"], "Diagnose per manufacturer data", 1000, 20000, 1.5) },
  { pattern: /^B0/, info: () => d("Body/Restraint System Fault", "airbag", "high", ["Body or restraint system fault"], "Body/restraint system diagnosis", 1000, 15000, 1.5) },
  { pattern: /^B[1-3]/, info: () => d("Manufacturer-Specific Body Fault", "body", "medium", ["Refer to OEM body code chart"], "Diagnose per manufacturer data", 500, 12000, 1) },
  { pattern: /^U0/, info: () => d("Network Communication Fault", "network", "high", ["CAN bus or module communication fault"], "CAN bus diagnosis", 500, 15000, 1.5) },
  { pattern: /^U[1-3]/, info: () => d("Manufacturer-Specific Network Fault", "network", "medium", ["Refer to OEM network code chart"], "Diagnose per manufacturer data", 500, 15000, 1.5) },
];

export interface DtcLookup extends DtcInfo {
  code: string;
  known: boolean; // exact KB hit vs family fallback
}

export function lookupDtc(rawCode: string): DtcLookup {
  const code = rawCode.trim().toUpperCase();
  const exact = DTC_DATABASE[code];
  if (exact) return { code, known: true, ...exact };
  for (const fam of FAMILY_FALLBACKS) {
    if (fam.pattern.test(code)) return { code, known: false, ...fam.info() };
  }
  return {
    code,
    known: false,
    ...d("Unrecognised Diagnostic Trouble Code", "unknown", "medium", ["Not in knowledge base — refer to report description"], "Diagnose per scanner description", 0, 0, 1),
  };
}
