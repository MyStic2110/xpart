import { eq, and, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import { vehicleMakes, vehicleModels } from "@/db/schema";

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client);

const MAKES = [
  "CAR", "Super Bike", "Bike", "baleno", "swift", "Citroen", "Datsun", "Mitsubishi", "TATA", "Volvo",
  "Force", "Bugatti", "McLaren", "Mazda", "Porsche", "Maserati", "Hummer", "Rolls Royce", "Land Rover", "Bentley",
  "Aston Martin", "Ferrari", "Reva", "Tesla", "Lamborghini", "MG", "Lexus", "GMC", "Mini", "Hindusthan",
  "Nissan", "Nexa", "Maruti", "I-Suzu", "Jeep", "Mahindra", "Skoda", "Renault", "Fiat", "Suzuki",
  "Volkswagen", "Mercedes-Benz", "Kia", "Chevrolet", "Jaguar", "Hyundai", "Audi", "Toyota", "Ford", "BMW",
  "Honda",
];

// [model name, make name, segment]
const MODELS: [string, string, string][] = [
  ["Elevate", "Honda", "Medium"], ["CAR", "CAR", "All"], ["Laura", "Skoda", "Medium"], ["Ritz", "Maruti", "Small"],
  ["EXTER", "Hyundai", "Medium"], ["Comet", "MG", "Small"], ["Lodge", "Renault", "Large"], ["C3", "Citroen", "Medium"],
  ["Grand Vitara", "Maruti", "Large"], ["Premium bike", "Super Bike", "XL / Premium"], ["Syros", "Kia", "Medium"],
  ["Hyryder", "Toyota", "Large"], ["Qualis", "Toyota", "Large"], ["Super Bike", "Super Bike", "Super Bikes"],
  ["Bike", "Bike", "Small Bike"], ["Hatchback", "swift", "Medium"], ["Meridian", "Jeep", "Large"],
  ["Taigun", "Volkswagen", "Medium"], ["McLaren", "McLaren", "XL / Premium"], ["Punch", "TATA", "Medium"],
  ["Astor", "MG", "Medium"], ["Slavia", "Skoda", "Large"], ["Liva", "Toyota", "Small"], ["Micra", "Nissan", "Small"],
  ["C5", "Citroen", "XL / Premium"], ["Koleos", "Renault", "Large"], ["Carens", "Kia", "Large"],
  ["Touareg", "Volkswagen", "XL / Premium"], ["XUV 700", "Mahindra", "XL / Premium"], ["Fabia", "Skoda", "Medium"],
  ["Go", "Datsun", "Small"], ["Go+", "Datsun", "Large"], ["redi-Go", "Datsun", "Small"], ["Jetta", "Volkswagen", "Large"],
  ["CR V", "Honda", "XL / Premium"], ["Vista", "TATA", "Small"], ["A Star", "Maruti", "Small"], ["Pulse", "Renault", "Small"],
  ["Ameo", "Volkswagen", "Medium"], ["Etios", "Toyota", "Medium"], ["Linia", "Fiat", "Medium"],
  ["Cedia", "Mitsubishi", "Medium"], ["Pajero", "Mitsubishi", "XL / Premium"], ["Lancer", "Mitsubishi", "Medium"],
  ["Nano", "TATA", "Small"], ["Alcazar", "Hyundai", "XL / Premium"], ["Kushaq", "Skoda", "Large"],
  ["Terrano", "Nissan", "Large"], ["Aria", "TATA", "XL / Premium"], ["Xylo", "Mahindra", "XL / Premium"],
  ["Hexa", "TATA", "XL / Premium"], ["Indica", "TATA", "Small"], ["Indigo", "TATA", "Medium"], ["Zest", "TATA", "Medium"],
  ["Tigor", "TATA", "Medium"], ["Harrier", "TATA", "XL / Premium"], ["Tiago", "TATA", "Small"], ["Altroz", "TATA", "Medium"],
  ["Nexon", "TATA", "Medium"], ["Safari", "TATA", "XL / Premium"], ["UVA", "Chevrolet", "Small"], ["S90", "Volvo", "XL / Premium"],
  ["S60", "Volvo", "XL / Premium"], ["XC40", "Volvo", "XL / Premium"], ["Vento", "Volkswagen", "Medium"],
  ["Virtus", "Volkswagen", "Large"], ["Passat", "Volkswagen", "Large"], ["Tiguan", "Volkswagen", "XL / Premium"],
  ["T-Roc", "Volkswagen", "Large"], ["XC90", "Volvo", "XL / Premium"], ["Polo", "Volkswagen", "Medium"],
  ["C-HR", "Toyota", "XL / Premium"], ["Corolla", "Toyota", "Large"], ["Urban Cruiser", "Toyota", "Medium"],
  ["Camry", "Toyota", "Large"], ["Vellfire", "Toyota", "XL / Premium"], ["Yaris", "Toyota", "Medium"],
  ["Glanza", "Toyota", "Medium"], ["Innova", "Toyota", "XL / Premium"], ["Fortuner", "Toyota", "XL / Premium"],
  ["Model Y", "Tesla", "XL / Premium"], ["Model X", "Tesla", "XL / Premium"], ["Model S", "Tesla", "XL / Premium"],
  ["Model 3", "Tesla", "XL / Premium"], ["Kodiaq", "Skoda", "XL / Premium"], ["Karoq", "Skoda", "XL / Premium"],
  ["Octavia", "Skoda", "Large"], ["Superb", "Skoda", "Large"], ["Rapid", "Skoda", "Medium"], ["Dawn", "Rolls Royce", "XL / Premium"],
  ["Wraith", "Rolls Royce", "XL / Premium"], ["Cullinan", "Rolls Royce", "XL / Premium"], ["Ghost", "Rolls Royce", "XL / Premium"],
  ["Phantom", "Rolls Royce", "XL / Premium"], ["Duster", "Renault", "Large"], ["Triber", "Renault", "Large"],
  ["Kwid", "Renault", "Small"], ["Kiger", "Renault", "Medium"], ["Reva", "Reva", "Small"], ["Panamera", "Porsche", "XL / Premium"],
  ["Macan", "Porsche", "XL / Premium"], ["911", "Porsche", "XL / Premium"], ["Cayenne", "Porsche", "XL / Premium"],
  ["Terra", "Nissan", "XL / Premium"], ["Leaf", "Nissan", "Large"], ["Sunny", "Nissan", "Large"], ["X-Trail", "Nissan", "XL / Premium"],
  ["e Power", "Nissan", "XL / Premium"], ["GT-R", "Nissan", "XL / Premium"], ["Kicks", "Nissan", "Medium"],
  ["Magnite", "Nissan", "Medium"], ["Cooper", "Mini", "XL / Premium"], ["Countryman", "Mini", "XL / Premium"],
  ["ZS EV", "MG", "Large"], ["Gloster", "MG", "XL / Premium"], ["Hector", "MG", "XL / Premium"], ["One", "Force", "XL / Premium"],
  ["Gurkha", "Force", "XL / Premium"], ["A Class", "Mercedes-Benz", "XL / Premium"], ["GT", "Mercedes-Benz", "XL / Premium"],
  ["G Class", "Mercedes-Benz", "XL / Premium"], ["GLS", "Mercedes-Benz", "XL / Premium"], ["V Class", "Maruti", "XL / Premium"],
  ["S Class", "Mercedes-Benz", "XL / Premium"], ["E Class", "Mercedes-Benz", "XL / Premium"], ["C Class", "Mercedes-Benz", "XL / Premium"],
  ["GranCabrio", "Maserati", "XL / Premium"], ["GranTurismo", "Maserati", "XL / Premium"], ["Ghibli", "Maserati", "XL / Premium"],
  ["Levante", "Maserati", "XL / Premium"], ["Quattroporte", "Maserati", "XL / Premium"], ["Eeco", "Maruti", "XL / Premium"],
  ["Ciaz", "Maruti", "Medium"], ["S-Cross", "Maruti", "Large"], ["Ignis", "Maruti", "Small"], ["XL6", "Maruti", "XL / Premium"],
  ["S-Presso", "Maruti", "Small"], ["Celario", "Maruti", "Small"], ["Alto", "Maruti", "Small"], ["Wagon R", "Maruti", "Medium"],
  ["Dzire", "Maruti", "Medium"], ["Ertiga", "Maruti", "XL / Premium"], ["Baleno", "Maruti", "Medium"], ["Brezza", "Maruti", "Large"],
  ["Swift", "Maruti", "Medium"], ["TUV 300", "Mahindra", "XL / Premium"], ["E2O", "Mahindra", "Small"], ["Verito", "Mahindra", "Medium"],
  ["Alturas", "Mahindra", "XL / Premium"], ["KUV100", "Mahindra", "Medium"], ["Marazzo", "Mahindra", "XL / Premium"],
  ["Bolero", "Mahindra", "Large"], ["XUV 500", "Mahindra", "Large"], ["XUV 300", "Mahindra", "Large"], ["Scorpio", "Mahindra", "Large"],
  ["Thar", "Mahindra", "Large"], ["UX", "Lexus", "XL / Premium"], ["LC", "Lexus", "XL / Premium"], ["RX", "Lexus", "XL / Premium"],
  ["NX", "Lexus", "XL / Premium"], ["LX", "Lexus", "XL / Premium"], ["ES", "Lexus", "XL / Premium"], ["LS", "Lexus", "XL / Premium"],
  ["Discovery Sport", "Land Rover", "XL / Premium"], ["Sport", "Land Rover", "XL / Premium"], ["Discovery", "Land Rover", "XL / Premium"],
  ["Defender", "Land Rover", "XL / Premium"], ["Evoque", "Land Rover", "XL / Premium"], ["Velar", "Land Rover", "XL / Premium"],
  ["Range Rover", "Land Rover", "XL / Premium"], ["Huracan", "Lamborghini", "XL / Premium"], ["Aventador", "Lamborghini", "XL / Premium"],
  ["Urus", "Lamborghini", "XL / Premium"], ["Stinger", "Kia", "XL / Premium"], ["Carnival", "Kia", "XL / Premium"],
  ["Sonet", "Kia", "Medium"], ["Seltos", "Kia", "Large"], ["Grand Cherokee", "Jeep", "XL / Premium"], ["Wrangler", "Jeep", "XL / Premium"],
  ["Compass", "Jeep", "Large"], ["XJF", "Jaguar", "XL / Premium"], ["F-PACE", "Jaguar", "XL / Premium"], ["XE", "Jaguar", "XL / Premium"],
  ["F-TYPE", "Jaguar", "XL / Premium"], ["XF", "Jaguar", "XL / Premium"], ["D-Max", "I-Suzu", "Large"], ["MU-X", "I-Suzu", "XL / Premium"],
  ["Palisade", "Hyundai", "XL / Premium"], ["Xcent", "Hyundai", "Medium"], ["Kona Electric", "Hyundai", "Large"],
  ["Tucson", "Hyundai", "XL / Premium"], ["Santro", "Hyundai", "Small"], ["Aura", "Hyundai", "Medium"], ["Verna", "Hyundai", "Medium"],
  ["Venue", "Hyundai", "Medium"], ["Creta", "Hyundai", "Large"], ["I 20", "Hyundai", "Medium"], ["H3", "Hummer", "XL / Premium"],
  ["H2", "Hummer", "XL / Premium"], ["NSX", "Honda", "XL / Premium"], ["Brio", "Honda", "Small"], ["BR-V", "Honda", "Large"],
  ["WR-V", "Honda", "Medium"], ["Jazz", "Honda", "Small"], ["Civic", "Honda", "Large"], ["Amaze", "Honda", "Medium"],
  ["City", "Honda", "Medium"], ["Ambassador", "Hindusthan", "Large"], ["Contessa", "Hindusthan", "Large"],
  ["Mustang", "Ford", "XL / Premium"], ["Aspire", "Ford", "Medium"], ["Freestyle", "Ford", "Medium"], ["Figo", "Ford", "Small"],
  ["Endeavour", "Ford", "XL / Premium"], ["Eco Sport", "Ford", "Large"], ["Linea", "Chevrolet", "Large"], ["Punto", "Fiat", "Small"],
  ["Adventure", "Fiat", "Large"], ["500", "Fiat", "XL / Premium"], ["812", "Ferrari", "XL / Premium"], ["Portofino", "Ferrari", "XL / Premium"],
  ["Roma", "Ferrari", "XL / Premium"], ["Trailblazer", "Chevrolet", "XL / Premium"], ["Tavera", "Chevrolet", "XL / Premium"],
  ["Spark", "Chevrolet", "Small"], ["Sail", "Chevrolet", "Medium"], ["Optra", "Chevrolet", "Medium"], ["Forester", "Chevrolet", "XL / Premium"],
  ["Enjoy", "Chevrolet", "XL / Premium"], ["Cruze", "Chevrolet", "Large"], ["Captiva", "Chevrolet", "XL / Premium"],
  ["Beat", "Chevrolet", "Small"], ["Aveo", "Chevrolet", "Medium"], ["Chiron", "Bugatti", "XL / Premium"], ["Veyron", "Bugatti", "XL / Premium"],
  ["Divo", "Bugatti", "XL / Premium"], ["8 Series", "BMW", "XL / Premium"], ["6 Series", "BMW", "XL / Premium"],
  ["7 Series", "BMW", "XL / Premium"], ["5 Series", "BMW", "XL / Premium"], ["M5", "BMW", "XL / Premium"], ["Z4", "BMW", "XL / Premium"],
  ["3 Series", "BMW", "XL / Premium"], ["X4", "BMW", "XL / Premium"], ["X3", "BMW", "XL / Premium"], ["X6", "BMW", "XL / Premium"],
  ["X7", "BMW", "XL / Premium"], ["X5", "BMW", "XL / Premium"], ["X1", "BMW", "XL / Premium"], ["Bentayga", "Bentley", "XL / Premium"],
  ["Continental", "Bentley", "XL / Premium"], ["Flying Spur", "Bentley", "XL / Premium"], ["R8", "Audi", "XL / Premium"],
  ["TT", "Audi", "XL / Premium"], ["A3", "Audi", "XL / Premium"], ["Q7", "Audi", "XL / Premium"], ["Q8", "Audi", "XL / Premium"],
  ["Q5", "Audi", "XL / Premium"], ["Q3", "Audi", "XL / Premium"], ["A8", "Audi", "XL / Premium"], ["A4", "Audi", "XL / Premium"],
  ["A6", "Audi", "XL / Premium"], ["Zagato", "Aston Martin", "XL / Premium"], ["DBS Superleggera", "Aston Martin", "XL / Premium"],
  ["DB11", "Aston Martin", "XL / Premium"], ["Vantage", "Aston Martin", "XL / Premium"], ["DBX", "Aston Martin", "XL / Premium"],
  ["I 10", "Hyundai", "Small"], ["Sonata", "Hyundai", "Small"], ["Elantra", "Hyundai", "Large"], ["Accent", "Hyundai", "Large"],
];

async function seed() {
  const existingCount = await db.execute(sql`select count(*) from vehicle_makes where org_id is null`);
  if (Number((existingCount as unknown as { count: string }[])[0].count) > 0) {
    console.log("Global vehicle catalog already seeded, skipping.");
    await client.end();
    return;
  }

  const makeIdByName = new Map<string, string>();
  for (const name of MAKES) {
    const [row] = await db.insert(vehicleMakes).values({ orgId: null, name }).returning();
    makeIdByName.set(name.toLowerCase(), row.id);
  }
  console.log(`Seeded ${MAKES.length} vehicle makes.`);

  let modelCount = 0;
  for (const [modelName, makeName, segment] of MODELS) {
    const makeId = makeIdByName.get(makeName.toLowerCase());
    if (!makeId) {
      console.warn(`Skipping model "${modelName}" — make "${makeName}" not found.`);
      continue;
    }
    await db.insert(vehicleModels).values({ orgId: null, makeId, name: modelName, segment });
    modelCount++;
  }
  console.log(`Seeded ${modelCount} vehicle models.`);

  await client.end();
}

seed();
