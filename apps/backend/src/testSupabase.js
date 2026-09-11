import { supabase } from "./lib/supabase.js";

const { data, error } = await supabase
  .from("homes")
  .select("*")
  .limit(5);

if (error) {
  console.error("Supabase connection failed:");
  console.error(error);
  process.exit(1);
}

console.log("Supabase connection successful!");
console.log(data);