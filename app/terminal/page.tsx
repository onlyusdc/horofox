import Chat from "../chat";

export default function Page() {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  return <Chat hasKey={hasKey} />;
}
