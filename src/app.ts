// drag & drop interfaces
interface Draggable {
  dragStarHandler(event: DragEvent): void;
  dragEndHandler(event: DragEvent): void;
}

interface DragTarget {
  dragOverHandler(event: DragEvent): void;
  dropHandler(event: DragEvent): void;
  dragLeaveHandler(event: DragEvent): void;
}

// -----------------------

// model

enum ProjectStatus {
  ACTIVE,
  FINISHED,
}

class Project {
  constructor(
    public id: string,
    public title: string,
    public description: string,
    public people: number,
    public status: ProjectStatus
  ) {}
}

// -----------------------
// project state managements

type Listener<T> = (items: T[]) => void;

class State<T> {
  protected listeners: Listener<T>[] = [];

  addListener(upListener: Listener<T>) {
    this.listeners.push(upListener);
  }
}

class ProjectState extends State<Project> {
  private projects: Project[] = [];

  private static INSTANCE: ProjectState;

  private constructor() {
    super();
  }

  public static GET_INSTANCE(): ProjectState {
    if (this.INSTANCE) {
      return this.INSTANCE;
    }
    this.INSTANCE = new ProjectState();
    return this.INSTANCE;
  }

  /**
   * The project will be ACTIVE
   * @param upTitle
   * @param upDescription
   * @param upPeople
   */
  public addNewProject(
    upTitle: string,
    upDescription: string,
    upPeople: number
  ) {
    const newProject: Project = new Project(
      Math.random().toString(),
      upTitle,
      upDescription,
      upPeople,
      ProjectStatus.ACTIVE
    );
    this.projects.push(newProject);

    this.updateListeners();
  }

  public moveProject(upId: string, upStatus: ProjectStatus) {
    const movingProject = this.projects.find((it) => it.id === upId);
    if (movingProject && movingProject.status !== upStatus) {
      movingProject.status = upStatus;

      this.updateListeners();
    }
  }

  private updateListeners() {
    for (const listener of this.listeners) {
      listener(this.projects.slice());
    }
  }
}

const projectState = ProjectState.GET_INSTANCE();

// -----------------------

// interfaces

/**
 * validation
 */
interface Validatable {
  value: string | number;
  required?: boolean;
  // just for string
  minLength?: number;
  // just for string
  maxLength?: number;
  // just for number
  min?: number;
  // just for number
  max?: number;
}

function validate(validatableInput: Validatable) {
  let isValid = true;
  if (validatableInput.required) {
    isValid = isValid && 0 !== validatableInput.value.toString().trim().length;
  }

  if (
    validatableInput.minLength != null &&
    typeof validatableInput.value === "string"
  ) {
    isValid =
      isValid && validatableInput.value.length >= validatableInput.minLength;
  }
  if (
    validatableInput.maxLength != null &&
    typeof validatableInput.value === "string"
  ) {
    isValid =
      isValid && validatableInput.value.length <= validatableInput.maxLength;
  }

  if (
    validatableInput.min != null &&
    typeof validatableInput.value === "number"
  ) {
    isValid = isValid && validatableInput.value >= validatableInput.min;
  }
  if (
    validatableInput.max != null &&
    typeof validatableInput.value === "number"
  ) {
    isValid = isValid && validatableInput.value <= validatableInput.max;
  }

  return isValid;
}

// -----------------------

// decorators
/**
 *
 * @param _target
 * @param methodName
 * @param descriptor
 */
function Autobind(
  _target: any,
  _methodName: string,
  descriptor: PropertyDescriptor
) {
  const oriMethod = descriptor.value;
  const adjDescriptor: PropertyDescriptor = {
    configurable: true,
    get() {
      const boudnFn = oriMethod.bind(this);
      return boudnFn;
    },
  };
  return adjDescriptor;
}

// -----------------------
// Components Classes

abstract class Component<T extends HTMLElement, U extends HTMLElement> {
  public templateElement: HTMLTemplateElement;
  public hostElement: T;
  public element: U;

  constructor(
    templateId: string,
    hostId: string,
    insertPosisition: InsertPosition,
    elementId?: string
  ) {
    this.templateElement = document.getElementById(
      templateId
    )! as HTMLTemplateElement;
    this.hostElement = document.getElementById(hostId)! as T;

    const importedNode = document.importNode(
      this.templateElement.content,
      true
    );
    this.element = importedNode.firstElementChild as U;
    if (elementId) {
      this.element.id = elementId;
    }

    this.attach(insertPosisition);
  }

  private attach(insertPosisition: InsertPosition) {
    this.hostElement.insertAdjacentElement(insertPosisition, this.element);
  }

  public abstract configure(): void;

  public abstract renderContent(): void;
}

/**
 *
 */
class ProjectItem
  extends Component<HTMLUListElement, HTMLLIElement>
  implements Draggable {
  private project: Project;

  get persons() {
    if (this.project.people === 1) {
      return "1 person";
    }
    return `${this.project.people} persons`;
  }

  constructor(hostId: string, upProject: Project) {
    super("single-project", hostId, "beforeend", upProject.id);
    this.project = upProject;

    this.configure();
    this.renderContent();
  }

  @Autobind
  public dragStarHandler(event: DragEvent) {
    event.dataTransfer!.setData("text/plain", this.project.id);
    event.dataTransfer!.effectAllowed = "move";
  }

  public dragEndHandler(_event: DragEvent) {
    console.log("dragEnd");
  }

  public configure() {
    this.element.addEventListener("dragstart", this.dragStarHandler);
    this.element.addEventListener("dragend", this.dragEndHandler);
  }

  public renderContent() {
    this.element.querySelector("h2")!.textContent = this.project.title;
    this.element.querySelector("h3")!.textContent = this.persons + " assigned";
    this.element.querySelector("p")!.textContent = this.project.description;
  }
}

/**
 * ProjectList class
 */
class ProjectList
  extends Component<HTMLDivElement, HTMLElement>
  implements DragTarget {
  public assignedProjects: Project[];

  constructor(private type: "active" | "finished") {
    super("project-list", "app", "beforeend", `${type}-projects`);

    this.assignedProjects = [];

    this.configure();
    this.renderContent();
  }

  @Autobind
  dragOverHandler(event: DragEvent) {
    if (event.dataTransfer && "text/plain" === event.dataTransfer.types[0]) {
      event.preventDefault();

      const ulistEl = this.element.querySelector("ul")!;
      ulistEl.classList.add("droppable");
    }
  }

  @Autobind
  dropHandler(event: DragEvent) {
    const projectId = event.dataTransfer!.getData("text/plain");
    projectState.moveProject(
      projectId,
      this.type === "active" ? ProjectStatus.ACTIVE : ProjectStatus.FINISHED
    );
  }

  @Autobind
  dragLeaveHandler(_event: DragEvent) {
    const ulistEl = this.element.querySelector("ul")!;
    ulistEl.classList.remove("droppable");
  }

  public configure() {
    this.element.addEventListener("dragover", this.dragOverHandler);
    this.element.addEventListener("dragleave", this.dragLeaveHandler);
    this.element.addEventListener("drop", this.dropHandler);

    projectState.addListener((projects: Project[]) => {
      const relevantProjects = projects.filter((it) => {
        if (this.type === "active") {
          return it.status === ProjectStatus.ACTIVE;
        }
        return it.status === ProjectStatus.FINISHED;
      });
      this.assignedProjects = relevantProjects;
      this.renderProjects();
    });
  }

  public renderContent() {
    const listId = `${this.type}-project-ulist`;
    this.element.querySelector("ul")!.id = listId;
    this.element.querySelector(
      "h2"
    )!.textContent = `${this.type.toUpperCase()} PROJECTS`;
  }

  private renderProjects() {
    const ulistEl = document.getElementById(
      `${this.type}-project-ulist`
    )! as HTMLUListElement;
    ulistEl.innerHTML = "";

    for (const projectItem of this.assignedProjects) {
      new ProjectItem(this.element.querySelector("ul")!.id, projectItem);
    }
  }
}

/**
 * ProjectInput class in form
 */
class ProjectInput extends Component<HTMLDivElement, HTMLFormElement> {
  public titleInputEl: HTMLInputElement;
  public descriptionInputEl: HTMLInputElement;
  public peopleInputEl: HTMLInputElement;

  constructor() {
    super("project-input", "app", "afterbegin", "user-input");

    this.titleInputEl = this.element.querySelector(
      "#title"
    ) as HTMLInputElement;
    this.descriptionInputEl = this.element.querySelector(
      "#description"
    ) as HTMLInputElement;
    this.peopleInputEl = this.element.querySelector(
      "#people"
    ) as HTMLInputElement;

    this.configure();
    this.renderContent();
  }

  public configure() {
    this.element.addEventListener("submit", this.submitHandler);
  }

  public renderContent() {}

  private gatherUserInputs(): [string, string, number] | void {
    const enteredTitle = this.titleInputEl.value;
    const enteredDescription = this.descriptionInputEl.value;
    const enteredPeople = this.peopleInputEl.value;

    const titleValidatable: Validatable = {
      value: enteredTitle,
      required: true,
    };
    const descriptionValidatable: Validatable = {
      value: enteredDescription,
      required: true,
      minLength: 5,
    };
    const peopleValidatable: Validatable = {
      value: +enteredPeople,
      required: true,
      min: 1,
      max: 5,
    };

    if (
      !(
        validate(titleValidatable) &&
        validate(descriptionValidatable) &&
        validate(peopleValidatable)
      )
    ) {
      alert("Invalid input, please try again!");
      return;
    }

    return [enteredTitle, enteredDescription, +enteredPeople];
  }

  @Autobind
  private submitHandler(event: Event) {
    event.preventDefault();

    const userInputs = this.gatherUserInputs();
    if (Array.isArray(userInputs)) {
      const [title, description, people] = userInputs;
      console.log(title, description, people);

      projectState.addNewProject(title, description, people);

      this.clearInputs();
    }
  }

  private clearInputs() {
    this.titleInputEl.value = "";
    this.descriptionInputEl.value = "";
    this.peopleInputEl.value = "";
  }
}

const projectInput = new ProjectInput();
const activeProjectList = new ProjectList("active");
const finishedProjectList = new ProjectList("finished");
