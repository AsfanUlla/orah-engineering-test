import { NextFunction, Request, Response } from "express"
import { getRepository } from "typeorm"
import { Group } from "../entity/group.entity"
import { GroupStudent } from "../entity/group-student.entity"
import { Roll } from "../entity/roll.entity"
import { StudentRollState } from "../entity/student-roll-state.entity"
import { CreateGroupInput, UpdateGroupInput, UpdateGroupMeta } from "../interface/group.interface"
import { map, chain, flattenDeep} from "lodash"
import { GroupStudentInput } from "../interface/group-student.interface"
import { Student } from "../entity/student.entity"


export class GroupController {
  private groupRepository = getRepository(Group)
  private groupStudentRepository = getRepository(GroupStudent)
  private rollRepository = getRepository(Roll)
  private studentRollStateRepository = getRepository(StudentRollState)
  private studentRepository = getRepository(Student)

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

    return await this.groupRepository.findOne(params.id).then((group) => {
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
    const { body: params } = request
    let groupToRemove = await this.groupRepository.findOne(params.id)
    if(groupToRemove !== undefined){
      await this.groupRepository.remove(groupToRemove)
    }
    return { "success": true }
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
        
    const GroupStudents = await this.groupStudentRepository.find()
    const studentIds = GroupStudents.map((obj) => obj.student_id)
    const students = await this.studentRepository
                        .createQueryBuilder()
                        .where("id IN (:...id)", { id: studentIds })
                        .getMany()
    return map(students, (student) => {
      return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        full_name: student.first_name + " " + student.last_name
      }
    })
  }


  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    // Task 2:
  
    // 1. Clear out the groups (delete all the students from the groups)
    await this.groupStudentRepository.clear()
   
    
    // 2. For each group, query the student rolls to see which students match the filter for the group
    const groups = await this.groupRepository.find()

    let GroupStudents = []
    let GroupMeta = []
    for (let group of groups){

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
       
      const incidentFilter = chain(studentsRollStates)
                              .countBy("student_id")
                              .pickBy((value) => {
                                if (group["ltmt"] == ">"){
                                  if(value > group["incidents"]) return value
                                } else if (group["ltmt"] == "<"){
                                  if(value < group["incidents"]) return value
                                }
                              })
                              .value()
      
      const groupStudenObject: [] = map(incidentFilter, (value, key) => {
        const groupStudentInput: GroupStudentInput = {
          student_id: key,
          group_id: group["id"],
          incident_count: value
        }
        return groupStudentInput
      })

      GroupStudents.push(groupStudenObject)

      const updateGroupMeta: UpdateGroupMeta = {
        id: group.id,
        run_at: new Date().toISOString(),
        student_count: groupStudenObject.length
      }

      GroupMeta.push(updateGroupMeta)
    }

    // 3. Update Group Srudent and Group Meta
    await this.groupStudentRepository.save(flattenDeep(GroupStudents))
    return await this.groupRepository.save(GroupMeta)
    //return { "success": true }
  }
}
