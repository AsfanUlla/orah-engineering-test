import { NextFunction, Request, Response } from "express"
import { getRepository } from "typeorm"
import { Group } from "../entity/group.entity"
import { GroupStudent } from "../entity/group-student.entity"
import { Roll } from "../entity/roll.entity"
import { StudentRollState } from "../entity/student-roll-state.entity"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface"
import { map, countBy} from "lodash"


export class GroupController {
  private groupRepository = getRepository(Group)
  private groupStudentRepository = getRepository(GroupStudent)
  private rollRepository = getRepository(Roll)
  private studentRollStateRepository = getRepository(StudentRollState)

  async allGroups(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    
    return this.groupRepository.find()
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    
    const { body : params } = request

    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt
    }

    const group = new Group()
    group.prepareToCreate(createGroupInput)

    return this.groupRepository.save(group)
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    
    const { body: params } = request

    await this.groupRepository.findOne(params.id).then((group) => {
      const updateGroupInput: UpdateGroupInput = {
        id: params.id,
        name: params.name,
        number_of_weeks: params.number_of_weeks,
        roll_states: params.roll_states,
        incidents: params.incidents,
        ltmt: params.ltmt
      }
      group.prepareToUpdate(updateGroupInput)

      return this.groupRepository.save(group)
    })
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    
    let groupToRemove = await this.groupRepository.findOne(request.params.id)
    await this.groupRepository.remove(groupToRemove).then(() => {
      return { "success": true }
    })
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
        
    return this.groupStudentRepository.find()
    
  }


  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    // Task 2:
  
    // 1. Clear out the groups (delete all the students from the groups)
    await this.groupStudentRepository.clear()
   
    
    // 2. For each group, query the student rolls to see which students match the filter for the group
    const groups = await this.groupRepository.find()
    const groupData: [] = map(groups, (group) => {
      const Groups: UpdateGroupInput = {
        id: group.id,
        name: group.name,
        number_of_weeks: group.number_of_weeks,
        roll_states: group.roll_states,
        incidents: group.incidents,
        ltmt: group.ltmt
      }
      return Groups
    })
    
    groupData.forEach(async (group) => {
      const fromDate: Date = new Date(Date.now() - (7*group["number_of_weeks"]) * 24 * 60 * 60 * 1000)
      const rolls = await this.rollRepository
                        .createQueryBuilder("roll")
                        .where("completed_at >= :cursor", { cursor: fromDate.toISOString() })
                        .getMany()
      const rollIds = rolls.map((obj) => obj["id"])
      const studentsRollStates = await this.studentRollStateRepository
                                    .createQueryBuilder('studentroll')
                                    .where("roll_id IN (:...rollIds) AND state = :state", 
                                            { 
                                              rollIds: rollIds, 
                                              state: group["roll_states"]
                                            }
                                          )
                                    .getMany()
      
      const studentStatesCount = countBy(studentsRollStates, "student_id")
      let GroupStudents = []
      if (group["ltmt"] == ">"){
        Object.keys(studentStatesCount)
          .forEach(
            (v) => {
              if(studentStatesCount[v] > group["incidents"]){
                GroupStudents.push(
                  {
                    "student_id": v,
                    "group_id": group["id"],
                    "incident_count": studentStatesCount[v]
                  }
                )
              }
            }
          )
      } else if(group["ltmt"] == "<"){
        Object.keys(studentStatesCount)
        .forEach(
          (v) => {
            if(studentStatesCount[v] < group["incidents"]){
              GroupStudents.push(
                {
                  "student_id": v,
                  "group_id": group["id"],
                  "incident_count": studentStatesCount[v]
                }
              )
            }
          }
        )
      }
      
      // 3. Add the list of students that match the filter to the group
      if (GroupStudents != undefined || GroupStudents.length != 0) {
        await this.groupStudentRepository.save(GroupStudents)
        await this.groupRepository.save(
          {
            "id": group["id"],
            "run_at": new Date().toISOString(),
            "student_count": GroupStudents.length
          }
        )
      }

    })
    return { "success": true }
  }
}
