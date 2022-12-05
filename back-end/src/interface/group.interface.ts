type STATES = "unmark" 
            | "present" 
            | "absent" 
            | "late"

type LTMT = "<" | ">"

export interface CreateGroupInput {
    name: string
    number_of_weeks: number
    roll_states: STATES
    incidents: number
    ltmt: LTMT
}

export interface UpdateGroupInput {
    id: number
    name: string
    number_of_weeks: number
    roll_states: STATES
    incidents: number
    ltmt: LTMT
}

export interface UpdateGroupMeta {
    id: number,
    run_at: string,
    student_count: number
}
