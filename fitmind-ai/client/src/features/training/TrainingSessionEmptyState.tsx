import { StateNotice } from "../../components/StateNotice";

export interface TrainingSessionEmptyStateProps {
  isAddActionEnabled?: boolean | undefined;
  onAddActionClick?: (() => void) | undefined;
}

export function TrainingSessionEmptyState() {
  return (
    <StateNotice
      description="点击右下角 + 从动作库添加本次训练动作。"
      icon="dumbbell"
      title="还没有添加动作"
    />
  );
}
