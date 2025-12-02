








class Task:
    _all = []

    def __init__(self, name, difficulty, priority, external):
        self.name = name
        self.difficulty = difficulty
        self.priority = priority
        self.external = external
        self.inital_parents = []
        self.parents = []


        if self not in Task._all:
            Task._all.append(self)




    @property
    def total(self):
        total = self.difficulty + self.priority + self.external
        return total

    @property
    def loops(self):
        answer = (self.total / 15) * 3
        int_answer = int(round(answer, 0))
        return int_answer

    @property
    def children(self):
        """Return all tasks that list `self` as a parent."""
        return [task for task in Task._all if self in task.parents]

    @property
    def magnitude(self):
        total = self.total * 3
        for child in self.children:
            total += child.total
        return total


    @property
    def magnitude_percentile(self):
        """Percentile of this task's magnitude among all tasks (0–100)."""
        magnitudes = [task.magnitude for task in Task._all]

        if len(magnitudes) == 1:
            return 100.0  # only one task → trivially top

        magnitudes_sorted = sorted(magnitudes)
        my_value = self.magnitude

        # rank = how many magnitudes are <= mine
        rank = sum(1 for m in magnitudes_sorted if m <= my_value)

        percentile = (rank - 1) / (len(magnitudes_sorted) - 1)

        return round(percentile, 2)



    def join_parent_in(self, parent):
        if parent.loops == 1:
            return 1

        join_in = ((1 - (self.total / 15)) * parent.loops) + 1
        hop = int(round(join_in, 0))

        return hop



    def __repr__(self):
        return (f"{self.total} - {self.name},  Loops: {self.loops}\n"
                f"(dif: {self.difficulty}, prio: {self.priority}, ext: {self.external})\n")

    def __str__(self):
        return self.name


idea = Task("idea", 5, 5, 5)
konzept = Task("konzept", 5, 5, 5)
getraenke = Task("getraenke", 3, 3, 5)
muellkonzept = Task("muellkonzept", 2, 3, 1)
beerpong = Task("beerpong", 3, 1, 1)

print(konzept)
print(getraenke)
print(muellkonzept)
print(beerpong)



#hardcode inital dependencies
getraenke.inital_parents.append(konzept)
muellkonzept.inital_parents.append(getraenke)
beerpong.inital_parents.append(muellkonzept)
beerpong.inital_parents.append(konzept)
konzept.inital_parents.append(idea)


print("\n\nCross Loop")
def get_all_parents(task, seen=None):
    """Return a set of all direct + indirect parents of `task`."""
    if seen is None:
        seen = set()

    for parent in task.inital_parents:
        if parent not in seen:
            seen.add(parent)
            get_all_parents(parent, seen)

    return seen


# expand dependencies for all tasks
for task in Task._all:
    all_parents = get_all_parents(task)
    task.parents = list(all_parents)







print("\n\nCheck")
#Check
for task in Task._all:
    print(task, [str(x) for x in task.parents])



print("\n\nMagnitude")
for task in Task._all:
    print(task, task.magnitude, task.magnitude_percentile)


print("\n\nIn Which Number should it go in")
for task in Task._all:
    print(f"{task.name} ({task.loops})")
    for child in task.children:
        if task in child.inital_parents:
            # join_in = ((1-(child.total / 15)) * task.loops) + 1

            print(f"        join "
                  f""
                  f"{child.join_parent_in(task)} - {child.name} ({child.loops})")




