// tsx 기반 실행체(봇·CLI·스크립트)용 env 로더 — Next는 .env.local을 자동 로드하지만 tsx는 아님
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" }); // 우선
dotenv.config(); // .env (이미 로드된 키는 덮지 않음)
