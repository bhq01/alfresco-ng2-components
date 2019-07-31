/*!
 * @license
 * Copyright 2019 Alfresco Software, Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    TasksService, QueryService, ProcessDefinitionsService, ProcessInstancesService,
    LoginSSOPage, ApiService, SettingsPage, IdentityService, GroupIdentityService, StringUtil
} from '@alfresco/adf-testing';
import { NavigationBarPage } from '../pages/adf/navigationBarPage';
import { ProcessCloudDemoPage } from '../pages/adf/demo-shell/process-services/processCloudDemoPage';
import { TasksCloudDemoPage } from '../pages/adf/demo-shell/process-services/tasksCloudDemoPage';
import { AppListCloudPage, LocalStorageUtil, BrowserActions } from '@alfresco/adf-testing';
import resources = require('../util/resources');
import { browser } from 'protractor';
import { ProcessListCloudConfiguration } from './config/process-list-cloud.config';
import { EditProcessFilterConfiguration } from './config/edit-process-filter.config';

describe('Process list cloud', () => {

    describe('Process List', () => {
        const loginSSOPage = new LoginSSOPage();
        const navigationBarPage = new NavigationBarPage();
        const appListCloudComponent = new AppListCloudPage();
        const processCloudDemoPage = new ProcessCloudDemoPage();
        const tasksCloudDemoPage = new TasksCloudDemoPage();
        const settingsPage = new SettingsPage();
        const apiService = new ApiService(
            browser.params.config.oauth2.clientId,
            browser.params.config.bpmHost, browser.params.config.oauth2.host, browser.params.config.providers
        );
        const processListCloudConfiguration = new ProcessListCloudConfiguration();
        const editProcessFilterConfiguration = new EditProcessFilterConfiguration();
        const processListCloudConfigFile = processListCloudConfiguration.getConfiguration();
        const editProcessFilterConfigFile = editProcessFilterConfiguration.getConfiguration();

        let tasksService: TasksService;
        let identityService: IdentityService;
        let groupIdentityService: GroupIdentityService;
        let processDefinitionService: ProcessDefinitionsService;
        let processInstancesService: ProcessInstancesService;
        let queryService: QueryService;

        let completedProcess, runningProcessInstance, switchProcessInstance, noOfApps, testUser, groupInfo,
            anotherProcessInstance;
        const candidateBaseApp = resources.ACTIVITI7_APPS.CANDIDATE_BASE_APP.name;

        beforeAll(async (done) => {

            await apiService.login(browser.params.identityAdmin.email, browser.params.identityAdmin.password);
            identityService = new IdentityService(apiService);
            groupIdentityService = new GroupIdentityService(apiService);
            testUser = await identityService.createIdentityUserWithRole(apiService, [identityService.ROLES.APS_USER]);

            groupInfo = await groupIdentityService.getGroupInfoByGroupName('hr');
            await identityService.addUserToGroup(testUser.idIdentityService, groupInfo.id);
            await apiService.login(testUser.email, testUser.password);

            processDefinitionService = new ProcessDefinitionsService(apiService);
            const processDefinition = await processDefinitionService
                .getProcessDefinitionByName(resources.ACTIVITI7_APPS.CANDIDATE_BASE_APP.processes.candidateGroupProcess, candidateBaseApp);

            const anotherProcessDefinition = await processDefinitionService
                .getProcessDefinitionByName(resources.ACTIVITI7_APPS.CANDIDATE_BASE_APP.processes.anotherCandidateGroupProcess, candidateBaseApp);

            processInstancesService = new ProcessInstancesService(apiService);
            await processInstancesService.createProcessInstance(processDefinition.entry.key, candidateBaseApp);

            runningProcessInstance = await processInstancesService.createProcessInstance(processDefinition.entry.key, candidateBaseApp, {
                'name': StringUtil.generateRandomString(),
                'businessKey': StringUtil.generateRandomString()
            });

            anotherProcessInstance = await processInstancesService.createProcessInstance(anotherProcessDefinition.entry.key, candidateBaseApp, {
                'name': StringUtil.generateRandomString(),
                'businessKey': StringUtil.generateRandomString()
            });

            switchProcessInstance = await processInstancesService.createProcessInstance(processDefinition.entry.key, candidateBaseApp, {
                'name': StringUtil.generateRandomString(),
                'businessKey': StringUtil.generateRandomString()
            });

            completedProcess = await processInstancesService.createProcessInstance(processDefinition.entry.key, candidateBaseApp, {
                'name': StringUtil.generateRandomString(),
                'businessKey': StringUtil.generateRandomString()
            });
            queryService = new QueryService(apiService);

            await browser.driver.sleep(4000); // eventual consistency query
            const task = await queryService.getProcessInstanceTasks(completedProcess.entry.id, candidateBaseApp);
            tasksService = new TasksService(apiService);
            const claimedTask = await tasksService.claimTask(task.list.entries[0].entry.id, candidateBaseApp);
            await tasksService.completeTask(claimedTask.entry.id, candidateBaseApp);

            await settingsPage.setProviderBpmSso(
                browser.params.config.bpmHost,
                browser.params.config.oauth2.host,
                browser.params.config.identityHost);
            loginSSOPage.loginSSOIdentityService(testUser.email, testUser.password);
            await LocalStorageUtil.setConfigField('adf-edit-process-filter', JSON.stringify(editProcessFilterConfigFile));
            await LocalStorageUtil.setConfigField('adf-cloud-process-list', JSON.stringify(processListCloudConfigFile));
            done();
        });

        afterAll(async (done) => {
            await processInstancesService.deleteProcessInstance(runningProcessInstance.entry.id, candidateBaseApp);
            await processInstancesService.deleteProcessInstance(anotherProcessInstance.entry.id, candidateBaseApp);
            await processInstancesService.deleteProcessInstance(switchProcessInstance.entry.id, candidateBaseApp);
            await apiService.login(browser.params.identityAdmin.email, browser.params.identityAdmin.password);
            await identityService.deleteIdentityUser(testUser.idIdentityService);
            done();
        });

        beforeEach(() => {
            navigationBarPage.navigateToProcessServicesCloudPage();
            appListCloudComponent.checkApsContainer();
            appListCloudComponent.goToApp(candidateBaseApp);
            tasksCloudDemoPage.taskListCloudComponent().checkTaskListIsLoaded();
            processCloudDemoPage.clickOnProcessFilters();
        });

        it('[C290069] Should display processes ordered by name when Name is selected from sort dropdown', async () => {
            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader().setStatusFilterDropDown('RUNNING')
                .setSortFilterDropDown('Name').setOrderFilterDropDown('ASC');

            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('ASC', 'Name')).toBe(true);

            processCloudDemoPage.editProcessFilterCloudComponent().setOrderFilterDropDown('DESC');

            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('DESC', 'Name')).toBe(true);

        });

        it('[C291783] Should display processes ordered by id when Id is selected from sort dropdown', async () => {
            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader().setStatusFilterDropDown('RUNNING')
                .setSortFilterDropDown('Id').setOrderFilterDropDown('ASC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('ASC', 'Id')).toBe(true);

            processCloudDemoPage.editProcessFilterCloudComponent().setOrderFilterDropDown('DESC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('DESC', 'Id')).toBe(true);

        });

        it('[C305054] Should display processes ordered by status when Status is selected from sort dropdown', async () => {
            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader().setStatusFilterDropDown('ALL')
                .setSortFilterDropDown('Status').setOrderFilterDropDown('ASC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('ASC', 'Status')).toBe(true);

            processCloudDemoPage.editProcessFilterCloudComponent().setOrderFilterDropDown('DESC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('DESC', 'Status')).toBe(true);
        });

        it('[C305054] Should display processes ordered by initiator when Initiator is selected from sort dropdown', async () => {
            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader().setStatusFilterDropDown('ALL')
                .setSortFilterDropDown('Initiator').setOrderFilterDropDown('ASC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('ASC', 'Initiator')).toBe(true);

            processCloudDemoPage.editProcessFilterCloudComponent().setOrderFilterDropDown('DESC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('DESC', 'Initiator')).toBe(true);
        });

        it('[C305054] Should display processes ordered by processdefinitionid date when ProcessDefinitionId is selected from sort dropdown', async () => {
            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader().setStatusFilterDropDown('ALL')
                .setSortFilterDropDown('ProcessDefinitionId').setOrderFilterDropDown('ASC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('ASC', 'Process Definition Id')).toBe(true);

            processCloudDemoPage.editProcessFilterCloudComponent().setOrderFilterDropDown('DESC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('DESC', 'Process Definition Id')).toBe(true);
        });

        it('[C305054] Should display processes ordered by processdefinitionkey date when ProcessDefinitionKey is selected from sort dropdown', async () => {
            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader().setStatusFilterDropDown('ALL')
                .setSortFilterDropDown('ProcessDefinitionKey').setOrderFilterDropDown('ASC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('ASC', 'Process Definition Key')).toBe(true);

            processCloudDemoPage.editProcessFilterCloudComponent().setOrderFilterDropDown('DESC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('DESC', 'Process Definition Key')).toBe(true);
        });

        it('[C305054] Should display processes ordered by last modified date when Last Modified is selected from sort dropdown', async () => {
            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader().setStatusFilterDropDown('ALL')
                .setSortFilterDropDown('LastModified').setOrderFilterDropDown('ASC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('ASC', 'Last Modified')).toBe(true);

            processCloudDemoPage.editProcessFilterCloudComponent().setOrderFilterDropDown('DESC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('DESC', 'Last Modified')).toBe(true);
        });

        it('[C305054] Should display processes ordered by business key date when BusinessKey is selected from sort dropdown', async () => {
            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader().setStatusFilterDropDown('ALL')
                .setSortFilterDropDown('BusinessKey').setOrderFilterDropDown('ASC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('ASC', 'Business Key')).toBe(true);

            processCloudDemoPage.editProcessFilterCloudComponent().setOrderFilterDropDown('DESC');
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().checkListIsSorted('DESC', 'Business Key')).toBe(true);
        });

        it('[C305054] Should display the actions filters Save, SaveAs and Delete', async () => {
            processCloudDemoPage.allProcessesFilter().clickProcessFilter();
            processCloudDemoPage.allProcessesFilter().checkProcessFilterIsDisplayed();
            expect(processCloudDemoPage.getActiveFilterName()).toBe('All Processes');
            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader();
            processCloudDemoPage.editProcessFilterCloudComponent().checkSaveButtonIsDisplayed().checkSaveAsButtonIsDisplayed()
                .checkDeleteButtonIsDisplayed();
        });

        it('[C297697] The value of the filter should be preserved when saving it', async () => {
            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader()
                .setProcessInstanceId(completedProcess.entry.id);

            processCloudDemoPage.editProcessFilterCloudComponent().clickSaveAsButton();
            processCloudDemoPage.editProcessFilterCloudComponent().editProcessFilterDialog().setFilterName('New').clickOnSaveButton();
            processCloudDemoPage.checkFilterIsActive('new');

            processCloudDemoPage.processListCloudComponent().checkContentIsDisplayedById(completedProcess.entry.id);
            expect(processCloudDemoPage.processListCloudComponent().getDataTable().numberOfRows()).toBe(1);

            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader();
            expect(processCloudDemoPage.editProcessFilterCloudComponent().getProcessInstanceId()).toEqual(completedProcess.entry.id);
        });

        it('[C297646] Should display the filter dropdown fine , after switching between saved filters', async () => {

            noOfApps = processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader().getNumberOfAppNameOptions();
            expect(processCloudDemoPage.editProcessFilterCloudComponent().checkAppNamesAreUnique()).toBe(true);
            BrowserActions.closeMenuAndDialogs();
            processCloudDemoPage.editProcessFilterCloudComponent().setStatusFilterDropDown('RUNNING')
                .setAppNameDropDown(candidateBaseApp).setProcessInstanceId(runningProcessInstance.entry.id);

            processCloudDemoPage.processListCloudComponent().checkContentIsDisplayedById(runningProcessInstance.entry.id);
            expect(processCloudDemoPage.editProcessFilterCloudComponent().getNumberOfAppNameOptions()).toBe(noOfApps);
            expect(processCloudDemoPage.editProcessFilterCloudComponent().checkAppNamesAreUnique()).toBe(true);
            BrowserActions.closeMenuAndDialogs();

            processCloudDemoPage.editProcessFilterCloudComponent().clickSaveAsButton();
            processCloudDemoPage.editProcessFilterCloudComponent().editProcessFilterDialog().setFilterName('SavedFilter').clickOnSaveButton();
            processCloudDemoPage.checkFilterIsActive('savedfilter');

            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader();
            expect(processCloudDemoPage.editProcessFilterCloudComponent().getProcessInstanceId()).toEqual(runningProcessInstance.entry.id);

            processCloudDemoPage.editProcessFilterCloudComponent().setStatusFilterDropDown('RUNNING')
                .setAppNameDropDown(candidateBaseApp).setProcessInstanceId(switchProcessInstance.entry.id);

            processCloudDemoPage.processListCloudComponent().checkContentIsDisplayedById(switchProcessInstance.entry.id);
            processCloudDemoPage.editProcessFilterCloudComponent().clickSaveAsButton();
            processCloudDemoPage.editProcessFilterCloudComponent().editProcessFilterDialog().setFilterName('SwitchFilter').clickOnSaveButton();
            processCloudDemoPage.checkFilterIsActive('switchfilter');

            processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader();
            expect(processCloudDemoPage.editProcessFilterCloudComponent().getProcessInstanceId()).toEqual(switchProcessInstance.entry.id);
            expect(processCloudDemoPage.editProcessFilterCloudComponent().getNumberOfAppNameOptions()).toBe(noOfApps);
            expect(processCloudDemoPage.editProcessFilterCloudComponent().checkAppNamesAreUnique()).toBe(true);
            BrowserActions.closeMenuAndDialogs();
        });

        describe('Process List - Check Action Filters', () => {

            beforeEach(async (done) => {
                await LocalStorageUtil.setConfigField('adf-edit-process-filter', JSON.stringify({
                    'actions': [
                        'save',
                        'saveAs'
                    ]
                }));
                navigationBarPage.navigateToProcessServicesCloudPage();
                appListCloudComponent.checkApsContainer();
                appListCloudComponent.goToApp(candidateBaseApp);
                tasksCloudDemoPage.taskListCloudComponent().checkTaskListIsLoaded();
                processCloudDemoPage.clickOnProcessFilters();
                done();
            });

            it('[C305054] Should display the actions filters Save and SaveAs, Delete button is not displayed', async () => {
                processCloudDemoPage.allProcessesFilter().clickProcessFilter();
                processCloudDemoPage.allProcessesFilter().checkProcessFilterIsDisplayed();
                expect(processCloudDemoPage.getActiveFilterName()).toBe('All Processes');
                processCloudDemoPage.editProcessFilterCloudComponent().clickCustomiseFilterHeader();
                processCloudDemoPage.editProcessFilterCloudComponent().checkSaveButtonIsDisplayed().checkSaveAsButtonIsDisplayed()
                    .checkDeleteButtonIsNotDisplayed();
            });

        });

    });

});
