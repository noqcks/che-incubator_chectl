/*********************************************************************
 * Copyright (c) 2019 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 **********************************************************************/

import { Command, flags } from '@oclif/command'
import { string } from '@oclif/parser/lib/flags'
import { cli } from 'cli-ux'

import { accessToken, cheDeployment, cheNamespace, devWorkspaceControllerNamespace, listrRenderer, skipKubeHealthzCheck } from '../../common-flags'
import { CheTasks } from '../../tasks/che'
import { ApiTasks } from '../../tasks/platforms/api'
import { getCommandSuccessMessage, initializeContext } from '../../util'

export default class Stop extends Command {
  static description = 'stop Eclipse Che server'

  static flags: flags.Input<any> = {
    help: flags.help({ char: 'h' }),
    chenamespace: cheNamespace,
    'dev-workspace-controller-namespace': devWorkspaceControllerNamespace,
    'deployment-name': cheDeployment,
    'che-selector': string({
      description: 'Selector for Eclipse Che server resources',
      default: 'app=che,component=che',
      env: 'CHE_SELECTOR'
    }),
    'access-token': accessToken,
    'listr-renderer': listrRenderer,
    'skip-kubernetes-health-check': skipKubeHealthzCheck
  }

  async run() {
    const ctx = initializeContext()
    const { flags } = this.parse(Stop)
    const Listr = require('listr')
    const notifier = require('node-notifier')
    const cheTasks = new CheTasks(flags)
    const apiTasks = new ApiTasks()

    let tasks = new Listr(undefined,
      {
        renderer: flags['listr-renderer'] as any,
        collapse: false
      }
    )

    tasks.add(apiTasks.testApiTasks(flags, this))
    tasks.add(cheTasks.checkIfCheIsInstalledTasks(flags, this))
    tasks.add([
      {
        title: 'Deployment doesn\'t exist',
        enabled: (ctx: any) => !ctx.isCheDeployed,
        task: async () => {
          await this.error(`E_BAD_DEPLOY - Deployment do not exist.\nA Deployment named "${flags['deployment-name']}" exist in namespace \"${flags.chenamespace}\", Eclipse Che server cannot be stopped.\nFix with: verify the namespace where Eclipse Che is running (oc get projects)\nhttps://github.com/eclipse/che`, { code: 'E_BAD_DEPLOY' })
        }
      }
    ],
      { renderer: flags['listr-renderer'] as any }
    )
    tasks.add(cheTasks.scaleCheDownTasks(this))
    tasks.add(cheTasks.waitPodsDeletedTasks())
    try {
      await tasks.run()
      cli.log(getCommandSuccessMessage(this, ctx))
    } catch (err) {
      this.error(err)
    }

    notifier.notify({
      title: 'chectl',
      message: getCommandSuccessMessage(this, ctx)
    })

    this.exit(0)
  }
}
