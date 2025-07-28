import { Type, type Static } from "@sinclair/typebox";

type CustomResourceStatusType= Static<typeof statusSchema>;

const statusSchema = Type.Object({
  observedGeneration: Type.Number(),
  conditions: Type.Array(Type.Object({
    type: Type.String(),
    status: Type.String({
      enum: ['True', 'False', 'Unknown']
    }),
    lastTransitionTime: Type.String(),
    reason: Type.String(),
    message: Type.String(),
  })),
});

type CustomResourceStatusOptions = {
  status?: CustomResourceStatusType;
  generation: number;
  save: (status: CustomResourceStatusType) => Promise<void>;
}

class CustomResourceStatus {
  #status: CustomResourceStatusType;
  #generation: number;
  #save: (status: CustomResourceStatusType) => Promise<void>;

  constructor(options: CustomResourceStatusOptions) {
    this.#save = options.save;
    this.#status = {
      observedGeneration: options.status?.observedGeneration ?? 0,
      conditions: options.status?.conditions ?? [],
    };
    this.#generation = options.generation;
  }

  public get generation() {
    return this.#generation;
  }

  public get observedGeneration() {
    return this.#status.observedGeneration;
  }

  public set observedGeneration(observedGeneration: number) {
    this.#status.observedGeneration = observedGeneration;
  }

  public getCondition = (type: string) => {
    return this.#status.conditions?.find((condition) => condition.type === type)?.status;
  }

  public setCondition = (type: string, condition: Omit<CustomResourceStatusType['conditions'][number], 'type' | 'lastTransitionTime'>) => {
    const currentCondition = this.getCondition(type);
    const newCondition = {
      ...condition,
      type,
      lastTransitionTime: new Date().toISOString(),
    };
    if (currentCondition) {
      this.#status.conditions = this.#status.conditions.map((c) => c.type === type ? newCondition : c);
    } else {
      this.#status.conditions.push(newCondition);
    }
  }

  public save = async () => {
    await this.#save({
      ...this.#status,
      observedGeneration: this.#generation,
    });
  }

  public toJSON = () => {
    return this.#status;
  }
}

export { CustomResourceStatus, statusSchema, type CustomResourceStatusType };