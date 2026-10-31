import type { Metadata } from "next";
import Builder from "./builder";
import "./builder.css";

export const metadata: Metadata = { title: "สร้าง Strategy | EASpaze" };

export default function BuildPage() {
  return <Builder />;
}
