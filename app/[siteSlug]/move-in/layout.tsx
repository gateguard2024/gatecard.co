import { MoveInProvider } from './state'

export default function MoveInLayout({ children }: { children: React.ReactNode }) {
  return <MoveInProvider>{children}</MoveInProvider>
}
